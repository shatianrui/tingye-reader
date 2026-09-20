export default function Download(){return <main style={{minHeight:'100dvh',background:'#F9F6ED',color:'#283C31',padding:'56px 24px',display:'grid',placeContent:'center'}}><section style={{maxWidth:460}}>
 <p style={{color:'#2B5C4B',fontSize:22,fontWeight:700}}>听页 · Android</p>
 <h1 style={{fontSize:34,margin:'20px 0'}}>书与声音，随身同行</h1>
 <p style={{lineHeight:1.9,color:'#68746C'}}>1.6.4（16005）· 正文与进度跨端同步<br/>“同步”现在会上传本机未备份的正文、下载云端正文，并同步阅读位置。持续朗读时定期保存进度，不再一直等到暂停才保存。临时语音限流按服务端时间等待重试，余额及服务商配额仍独立生效。</p>
 <p style={{lineHeight:1.9,color:'#68746C'}}>保留 DeX 外接屏密度修复、自由窗口、宽屏按钮、键盘快捷键与 EPUB 滚轮翻页。保留连贯开播缓冲、近期语音缓存、折叠屏布局、原书图文及 PDF 原始页面。</p>
 <a href="/api/releases/android" style={{display:'block',margin:'30px 0',padding:18,textAlign:'center',borderRadius:14,background:'#2B5C4B',color:'#fff',textDecoration:'none',fontWeight:600}}>下载 Android APK · 1.6.4（16005）</a>
 <ol style={{paddingLeft:22,lineHeight:1.9,fontSize:14}}>
  <li>直接覆盖安装，不要卸载，保留本机书籍。</li>
  <li>两端登录同一听页账号；iOS 升级至 <a href="/install" style={{color:'#2B5C4B'}}>1.7.6（33）</a>。</li>
  <li>先在有原书的安卓端点“同步”，等待显示上传完成，再在 iOS 点“同步”。旧安卓版的同步不会上传正文。</li>
 </ol>
 <p style={{lineHeight:1.9,fontSize:14}}>单本云端正文最多 18MB，账号总容量 50MB；失败会显示具体原因。本机正文仍可离线阅读。原 ChatGPT 网站账号的书籍尚未自动迁移。</p>
 <p style={{lineHeight:1.9,fontSize:14}}>应用每日语音字数不限；保留每账号每分钟 60 次的频率保护。单请求 1000 字，App 自动分段；语音服务商余额和配额另计。</p>
 <p><a href="/releases/ios175-evidence/index.html" style={{color:'#2B5C4B'}}>查看跨端同步与翻页测试说明 →</a></p>
 <p style={{marginTop:24}}><a href="/login" style={{color:'#2B5C4B'}}>进入网页版 →</a></p>
</section></main>;}
