import type { Metadata } from "next";
import Image from "next/image";
import {iosRelease} from "@/lib/ios-release";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "安装微读（听页）· iPhone",
  description: "听页 iPhone 设备安装版，原生阅读与听书。",
};

const installUrl = `itms-services://?action=download-manifest&url=${encodeURIComponent(iosRelease.manifestUrl)}`;

export default function Install() {
  return (
    <main style={{ minHeight: "100dvh", background: "#F9F6ED", color: "#283C31", padding: "40px 24px", display: "grid", placeContent: "center" }}>
      <section style={{ maxWidth: 460 }}>
        <Image src="/releases/tingye-icon-170.png" alt="微读图标，与安卓版本一致" width={88} height={88} priority style={{borderRadius:22}}/>
        <p style={{ color: "#2B5C4B", fontSize: 22, fontWeight: 700 }}>微读（听页）· iPhone</p>
        <h1 style={{ fontSize: 34, margin: "20px 0" }}>把书装进口袋</h1>
        <p style={{ lineHeight: 1.9, color: "#756C61" }}>{iosRelease.version}（{iosRelease.buildNumber}）· 安卓同款书架与阅读体验<br />原书图文与封面 · 隐藏式阅读菜单 · 目录跳转 · 字体背景 · 语速调节 · 本地 / GLM / MiniMax</p>
        <p style={{fontSize:14,lineHeight:1.8,color:"#756C61"}}>旧书若只有纯文字，请长按封面，选择“修复原书图文 / 封面”，再选择同一本书的原 EPUB。保留书架条目与阅读位置。</p>
        <p style={{fontSize:14,lineHeight:1.8,color:"#2B5C4B"}}>连接 tingye-reader.vercel.app<br/>使用听页网页版的用户名和密码登录。</p>
        <p style={{fontSize:14,lineHeight:1.8,color:"#2B5C4B"}}>1.7.7 更新：修复安卓上传进度后，iOS 恢复旧位置或延迟保存导致进度回退的问题。同步后显示更新到的章节和句子；打开书籍、重新排版不会产生新的阅读进度。请直接覆盖安装，不要卸载旧版。</p>
        <p style={{fontSize:14,lineHeight:1.8}}><a href="/releases/ios176-evidence/index.html" style={{color:'#2B5C4B'}}>查看云端书架恢复与同步验证</a>（实际书库代码与真实 API / 存储测试，非真机验证）</p>
        <p style={{fontSize:14,lineHeight:1.8}}>跨端同步：先升级安卓至 <a href="/download" style={{color:'#2B5C4B'}}>1.6.4（16005）</a>，在有原书的安卓端点“同步”，确认上传完成后，再到 iOS 点“同步”。两端须登录同一听页账号。单本云端正文最多 18MB，账号总容量 50MB；失败会显示具体原因。</p>
        <a href={installUrl} style={{ display: "block", margin: "30px 0 20px", padding: 18, textAlign: "center", borderRadius: 14, background: "#2B5C4B", color: "#fff", textDecoration: "none", fontWeight: 600 }}>安装到 iPhone</a>
        <ol style={{ paddingLeft: 22, lineHeight: 2, fontSize: 15 }}>
          <li>在 iPhone 的 Safari 中打开此页面。</li>
          <li>点击上方按钮，在系统提示中确认安装。</li>
          <li>返回主屏幕，等待“微读”安装完成后打开；名称和图标与安卓一致。</li>
        </ol>
        <p style={{lineHeight:1.9,fontSize:14}}>安装后在“我”页底部确认版本 {iosRelease.version}。请直接覆盖安装，保留本机书籍。</p>
        <details style={{margin:'24px 0',fontSize:14}}>
          <summary style={{cursor:'pointer',color:'#2B5C4B'}}>界面参考（1.7.0）</summary>
          <p style={{lineHeight:1.8,color:'#68746C'}}>iPhone 16 Pro Max 原生模拟器截图，展示测试书籍。</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>
            {[
              ['01-native-shelf.png','书架与封面'],
              ['02-native-original-reader.png','原书图文'],
              ['03-native-reader-menu.png','阅读功能栏'],
              ['04-native-reading-settings.png','字体与排版'],
              ['05-native-voice-settings.png','背景与语音'],
              ['05b-native-speed-settings.png','语速调节'],
            ].map(([file,label])=><a key={file} href={'/releases/ios170-preview/'+file} style={{color:'#2B5C4B',textDecoration:'none'}}><Image src={'/releases/ios170-preview/'+file} alt={label} width={1320} height={2868} style={{width:'100%',height:'auto',borderRadius:12,border:'1px solid #E6E4D9'}}/><p>{label}</p></a>)}
          </div>
        </details>
        <p style={{ lineHeight: 1.9, fontSize: 14, color: "#68746C" }}>此版本仅适用于证书中已登记的 iPhone，需要 iOS 16.4 或更新版本。签名有效期至 2027 年 9 月 4 日。</p>
        <p style={{ lineHeight: 1.9, fontSize: 14, color: "#68746C" }}>如果在聊天软件内点击没有反应，请复制本页链接到 Safari 再安装。无需自行导入证书或重新签名。</p>
        <p style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 24, fontSize: 14 }}>
          <a href={iosRelease.ipaUrl} style={{ color: "#2B5C4B" }}>下载 IPA · {iosRelease.version}（{iosRelease.buildNumber}）</a>
          <a href="/download" style={{ color: "#2B5C4B" }}>Android 版本</a>
          <a href="/login" style={{ color: "#2B5C4B" }}>进入网页版</a>
        </p>
        <p style={{fontSize:12,lineHeight:1.8,color:'#756C61',overflowWrap:'anywhere'}}>文件名：{iosRelease.ipaUrl.split('/').pop()}<br/>文件大小：{iosRelease.bytes.toLocaleString('en-US')} 字节<br/>SHA-256：{iosRelease.sha256}</p>
      </section>
    </main>
  );
}
