'use client';
import {useState,useEffect,type FormEvent} from 'react';
import {BookOpen,ArrowRight,Copy,Check} from 'lucide-react';
import styles from './login.module.css';
export default function Login(){
 const [invitation,setInvitation]=useState('');
 useEffect(()=>{const invite=new URLSearchParams(window.location.hash.slice(1)).get('invite');if(invite&&/^[a-f0-9]{64}$/.test(invite)){setInvitation(invite);setMode('register');history.replaceState(null,'',window.location.pathname);}},[]);
 const [mode,setMode]=useState<'login'|'register'|'recover'>('login'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[recovery,setRecovery]=useState(''),[copied,setCopied]=useState(false),[saved,setSaved]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError('');try{const fields=new FormData(event.currentTarget);const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:mode,...Object.fromEntries(fields)})});const result=await response.json();if(!response.ok)throw new Error(result.error||'暂时无法登录。');if(result.recoveryCode)setRecovery(result.recoveryCode);else window.location.assign('/');}catch(e){setError(e instanceof TypeError?'网络连接失败，请检查网络后重试。':e instanceof Error?e.message:'操作失败。');}finally{setBusy(false);}}
 return <main className={styles.page}><div className={styles.brand}><BookOpen size={30}/><span>听页</span></div><section className={styles.card}>
 {recovery?<><span className={styles.eyebrow}>账号已准备好</span><h1>保存你的恢复码</h1><p>忘记密码时，用这串恢复码找回账号。它只在这里显示一次，请保存到安全的地方。</p><code className={styles.code}>{recovery}</code><button className={styles.secondary} onClick={async()=>{try{await navigator.clipboard.writeText(recovery);setCopied(true);}catch{setError('请长按恢复码复制。');}}}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'已复制':'复制恢复码'}</button><label className={styles.confirm}><input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)}/>我已妥善保存恢复码</label><button className={styles.primary} disabled={!saved} onClick={()=>window.location.assign('/')}>进入书架 <ArrowRight size={18}/></button></>:<>
 <span className={styles.eyebrow}>{mode==='login'?'欢迎回来':'你的文字，随身相伴'}</span><h1>{mode==='login'?'登录你的书架':mode==='register'?'创建听页账号':'找回账号'}</h1><p>{mode==='login'?'继续上次的阅读，让声音陪你读下去。':mode==='register'?'使用邀请码注册，无需手机号或第三方账号。':'输入用户名和恢复码，设置新密码。'}</p>
 <form onSubmit={submit}><label>用户名<input name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="3–24 位字母、数字或下划线"/></label>
 <label>{mode==='recover'?'新密码':'密码'}<input name="password" type="password" required minLength={10} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} placeholder="至少 10 位字符"/></label>
 {mode==='register'&&<label>邀请码<input name="invite" value={invitation} onChange={e=>setInvitation(e.target.value.trim())} required minLength={64} maxLength={64} autoComplete="off" placeholder="粘贴收到的邀请码"/></label>}
 {mode==='recover'&&<label>恢复码<input name="recoveryCode" required minLength={64} maxLength={64} autoComplete="off" placeholder="注册时保存的恢复码"/></label>}
 {error&&<div className={styles.error} role="alert">{error}</div>}<button className={styles.primary} disabled={busy}>{busy?'正在处理…':mode==='login'?'登录':mode==='register'?'创建账号':'重置密码'}<ArrowRight size={18}/></button></form>
 <div className={styles.links}><button disabled={busy} onClick={()=>{setMode(mode==='register'?'login':'register');setError('');}}>{mode==='register'?'已有账号，去登录':'使用邀请码注册'}</button><button disabled={busy} onClick={()=>{setMode(mode==='recover'?'login':'recover');setError('');}}>{mode==='recover'?'返回登录':'忘记密码'}</button></div></>}
 </section><footer className={styles.footer}>本机保存书籍 · 多设备同步进度</footer></main>;
}
