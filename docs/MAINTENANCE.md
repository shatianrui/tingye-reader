# 维护说明

## 源码基线

从当前维护目录整理，未复制旧 Git 历史、旧壳应用、缓存、安装包、用户数据或签名材料。原工作目录与线上部署不受影响。保留第三方 LICENSE、字体声明与阅读器资源。

移动端入口为 index.ts → App.tsx → src/tingye/ReaderApplication.tsx。导入、书架、原版排版、封面、朗读、同步集中在 src/tingye；原生模块在 modules。网站 API 在 apps/web/app/api，校验、数据库和 TTS 封装在 apps/web/lib。

Android 1.6.4 / 16005 与 iOS 1.7.7 / 34 各自作为基线。未来可在测试覆盖下提取共享解析、同步、语音逻辑，不要一次性替换平台实现。

## 修改与回归

1. 从 main 新建分支，记录涉及平台。
2. 运行对应工程 typecheck 和 test；改阅读器时运行 build:reader 及原版排版测试。
3. 同步覆盖 Android 上传 → iOS 下载、反方向、离线进度、冲突和删除恢复。iOS 跨端测试读取同仓库 Android 实现。
4. 真机检查 EPUB 文字与插图、封面、字体重排、连续朗读、跨页高亮、设置后播放、后台与中断。Android 检查折叠和 DeX 缩放，iOS 检查 iPhone 16 Pro Max 安全区。
5. 分别增加版本号并使用 CLI 构建。源码检查不等于真机验证或签名构建。

web/scripts/verify-*-live.* 是显式运行的在线验证，跨端脚本会创建并清理临时账号、书籍、存储对象，需要目标环境配置；不在 CI 自动运行。优先测试环境。cleanup.mjs 默认只读预览，使用 `--apply` 才会删除过期会话和废弃上传。

登录 IP 限流只信任 `AUTH_IP_HEADER` 指定的单一 IP 头。腾讯云配置由 Caddy 覆盖 `X-Tingye-Client-IP` 为连接来源地址，并删除可伪造的其他 IP 头；应用不直接对公网开放。应用和 Caddy 配置需一起更新。若增加 CDN/其他代理，应先配置可信代理来源再调整取值，不能直接信任用户提供的 `X-Forwarded-For`。Vercel 部署可设置 `AUTH_IP_HEADER=x-vercel-forwarded-for`。

依赖检查使用 `npm audit --audit-level=high`。Next.js 与 eslint-config-next 保持同版本。移动端对 `xcode` 的 `uuid` 依赖单独固定为兼容 CommonJS 的 11.1.1，修复 [GHSA-w5hq-g745-h8pq](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq)；`tools/tests/xcode-compat.cjs` 覆盖实际调用的 v4 标识生成和项目文件往返读写。上游 xcode 更新依赖后可移除此覆盖，不要使用会降级 Expo SDK 的 `npm audit fix --force`。

## 发布记录

Windows 1.10.0 首次发布：`apps/desktop` 以 Electron 运行 iOS 的同一套界面。用户文件与界面资源都通过 `tingye://` 协议提供（`tingye://data` 仅能读写用户数据目录），书页在沙盒 iframe 中渲染，由主进程注入 react-native-webview 桥并把 `tingye:` 加入书页 CSP；网络请求经主进程转发，云端无需 CORS。修改 iOS 中的原生调用（expo-file-system、expo-audio、OriginalReader 的注入格式、书页 nonce 等）时，同步检查 `apps/desktop/src/shims` 并运行 `npm test` 与 `npm run test:e2e`。

iOS 1.10.0 / 48 改为水墨风界面：外壳配色（`src/theme/tokens.ts`）为宣纸底、浓淡墨和单一朱砂点缀，圆角收为直角；标题与印章使用随包的马善政毛笔字（`InkBrush`，OFL，许可证见 `assets/fonts/MaShanZheng-OFL.txt` 与应用内开源字体许可）。阅读纸色去掉绿色，`src/tingye/themes.ts` 保留原主题 id（如 sage 现为烟雨、forest 现为夜墨），已保存的偏好无需迁移。无封面书籍改为线装书题签封面；装饰元素在 `src/components/Ink.tsx`。电纸书模式的样式与对比度不变。

iOS 1.9.2 / 44 将朗读高亮通过独立订阅直接发送至 WebView，先于普通界面状态通知；同一句内的字位置不再触发整个阅读界面渲染。同页内不逐字回传页面事件，停止时回传最终位置；EPUB / PDF 复用未改变的整句高亮，原生音频位置采样为 50ms。`tests/playback-bridge.cjs` 覆盖三个引擎的 1.5 倍速模拟事件、暂停恢复及章节隔离，`test:reader` 覆盖逐字更新无页面反馈循环和停止位置保存。GLM 缺失实际时间戳时仍为明确标注的进度估算；这些检查不能替代 iPhone 上的声音与画面同步验收。

建议 tag 标记平台和版本。新构建核对入口、API 域名、版本、图标和签名，独立制品存储中保存安装包及哈希。私有 GitHub Releases 附件需登录，不适合作为未登录手机用户的公开下载链接。

数据库和书籍备份在服务商侧管理。本仓库只负责源码。生产签名材料应在独立安全位置备份。
