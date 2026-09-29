export default function Download(){return <main style={{minHeight:'100dvh',background:'#F9F6ED',color:'#283C31',padding:'56px 24px',display:'grid',placeContent:'center'}}><section style={{maxWidth:460}}>
 <p style={{color:'#2B5C4B',fontSize:22,fontWeight:700}}>听页 · Android</p>
 <h1 style={{fontSize:34,margin:'20px 0'}}>书与声音，随身同行</h1>
 <p style={{lineHeight:1.9,color:'#68746C'}}>1.8.0（18001）· 完整备份与还原<br/>正文、原书图片、封面、排版和阅读位置一起上传。校验完整后再发布；已有本机副本也能恢复到备份中的位置。</p>
 <p style={{lineHeight:1.9,color:'#68746C'}}>保留 DeX、折叠屏布局、字体设置、连贯朗读、原书图文和 PDF 原始页面。</p>
 <a href="/api/releases/android" style={{display:'block',margin:'30px 0',padding:18,textAlign:'center',borderRadius:14,background:'#2B5C4B',color:'#fff',textDecoration:'none',fontWeight:600}}>下载 Android APK · 1.8.0（18001）</a>
 <ol style={{paddingLeft:22,lineHeight:1.9,fontSize:14}}>
  <li>直接覆盖安装，不要卸载，保留本机书籍。</li>
  <li>各设备登录同一听页账号；iOS 也升级至 <a href="/install" style={{color:'#2B5C4B'}}>1.8.0</a>。</li>
  <li>有原书的设备：点“同步”→“上传本机备份”，等待上传完成。</li>
  <li>另一台设备：点“同步”→“从云端还原”，书籍和阅读位置一起恢复。</li>
 </ol>
 <p style={{lineHeight:1.9,fontSize:14}}>还原会替换该书已有的本机内容和阅读位置。阅读后换设备前，请上传最新备份。旧版备份接口已停用，不会自动覆盖新版云端数据。</p>
 <p style={{lineHeight:1.9,fontSize:14}}>单本完整备份最多 50MB，账号总容量 500MB。上传失败会显示具体原因，本机书籍仍可离线阅读。</p>
 <p style={{marginTop:24}}><a href="/login" style={{color:'#2B5C4B'}}>进入网页版 →</a></p>
</section></main>;}
