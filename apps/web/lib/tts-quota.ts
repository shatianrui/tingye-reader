import type postgres from 'postgres';

export function dailyCharacterLimit(value: string | undefined) {
  if (value === '0') return 0;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1000 ? limit : 50000;
}

export class TtsQuotaError extends Error {
  constructor(public kind: 'daily' | 'frequency', public limit: number, public resetsAt: Date) {
    const time = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(resetsAt);
    super(kind === 'daily'
      ? `已达到网站本轮 24 小时的 ${limit.toLocaleString('zh-CN')} 字云端朗读上限，将于北京时间 ${time} 恢复。可先使用本地语音。`
      : '语音请求过快，请稍候再播放。');
  }
  response() {
    const retryAfter = Math.max(1, Math.ceil((this.resetsAt.getTime() - Date.now()) / 1000));
    return Response.json({error: this.message, code: this.kind === 'daily' ? 'TTS_DAILY_LIMIT' : 'TTS_RATE_LIMIT',
      limit: this.limit, resetsAt: this.resetsAt.toISOString(), retryAfter},
    {status: 429, headers: {'Retry-After': String(retryAfter), 'Cache-Control': 'no-store'}});
  }
}

// Reserve atomically before contacting the paid provider. Rejected attempts never
// increase the counter; failed synthesis refunds only its original time window.
export async function reserveTtsBudget(sql: ReturnType<typeof postgres>, key: string,
  limit: number, seconds: number, amount: number, kind: 'daily' | 'frequency') {
  if (limit === 0) return async () => {};
  const rows = await sql`
    insert into tingye.rate_limits(key,count,expires_at)
    values(${key},${amount},now()+${seconds}*interval '1 second')
    on conflict(key) do update set
      count=case when tingye.rate_limits.expires_at<=now() then excluded.count
        else tingye.rate_limits.count+excluded.count end,
      expires_at=case when tingye.rate_limits.expires_at<=now() then excluded.expires_at
        else tingye.rate_limits.expires_at end
    where tingye.rate_limits.expires_at<=now() or tingye.rate_limits.count+${amount}<=${limit}
    returning expires_at::text as window_token`;
  if (!rows.length) {
    const current = await sql`select expires_at from tingye.rate_limits where key=${key}`;
    throw new TtsQuotaError(kind, limit, new Date(current[0]?.expires_at ?? Date.now() + seconds * 1000));
  }
  let refunded = false;
  return async () => {
    if (refunded) return;
    refunded = true;
    await sql`update tingye.rate_limits set count=greatest(0,count-${amount})
      where key=${key} and expires_at::text=${rows[0].window_token}`;
  };
}
