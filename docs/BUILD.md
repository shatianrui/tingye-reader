# CLI 构建与部署

## Android APK

在 apps/android 工作。要求 Node.js 22、JDK 17、Android SDK（平台及 NDK 版本以 android/build.gradle、Gradle 配置为准）、PowerShell 7。android/ 是包含定制功能的正式原生工程，必须保留；不要执行覆盖它的 clean prebuild。

设置 JAVA_HOME、ANDROID_HOME（或 ANDROID_SDK_ROOT）。签名使用原应用的私有 keystore，配置环境变量：

Windows 原生 C++ 编译存在 260 字符路径限制，建议将 Android 工程复制或签出到短路径（如 `D:/ty180`）后构建，依赖也应安装在短路径下；单纯软链接 node_modules 不能消除其真实长路径。可设置 `TINGYE_CXX_DIR` 指定较短的 CMake 临时目录。

- ANDROID_KEYSTORE_PATH：keystore 文件路径。
- ANDROID_KEY_ALIAS：密钥别名。
- ANDROID_STORE_PASSWORD、ANDROID_KEY_PASSWORD：对应密码。
- ANDROID_BUILD_TOOLS_VERSION：可选，默认 36.0.0。
- GRADLE_USER_HOME：可选，构建缓存位置。

```powershell
cd apps/android
npm ci
npm run typecheck
npm test
npm run build:apk
```

输出在 releases/，脚本对 APK 对齐并验证签名。必须使用旧版相同签名才能覆盖安装。仅需未签名产物时运行 `pwsh -File tools/build-local.ps1 -Unsigned`。调试 keystore 不入库，需要 debug 构建时自行创建标准 Android 调试 keystore。

## iOS IPA

iOS IPA 由 GitHub Actions 的 `Build unsigned iOS IPA` 工作流在 GitHub macOS
Runner 上调用 CocoaPods 与 Xcode 构建，不使用 EAS 云构建。工作流先执行类型
检查、完整测试和真实 WebView 阅读器测试，再归档未签名的 iOS 真机 app，
将其打包为 `*-unsigned.ipa`，校验版本、Bundle ID、arm64 架构、无签名及
归档完整性，并上传 IPA 与 SHA-256 为 Actions Artifact。无须 Apple 证书或
GitHub Secrets。构建使用 Xcode 26.3，并对已安装的 `expo-modules-jsi`
执行限定到 `RuntimeScheduler` 构造函数的编译器兼容修补；若上游源码改变，
脚本会失败而非静默覆盖。

**未签名 IPA 不能通过网站 OTA 或直接安装在普通 iPhone 上。** 后续若要安装，
仍须用有效 Apple 证书和包含目标设备 UDID 的 Ad Hoc 描述文件重新签名；
不要将未签名文件替换网站当前可安装的 IPA。

## 网站 / Vercel

apps/web/.env.example 列出配置。网站支持 PostgreSQL 与兼容 S3 的私有
`tingye-books` 桶；腾讯云部署默认使用同机 PostgreSQL 和 MinIO。首次部署检查
db/ 和 scripts/migrate.mjs，再执行 `npm run db:migrate`；邀请注册使用
`npm run invite:create`。迁移会修改数据库，先核对目标环境。

```sh
cd apps/web
npm ci
npm test
npm run build
```

Vercel 项目 Root Directory 设置为 apps/web；将 .env.example 对应变量填入 Vercel 环境配置。也可在该目录使用 Vercel CLI link / deploy。此次导入未修改现有生产项目 Git 关联，也未触发部署。

### 腾讯云 Docker 部署

`deploy/tencent` 提供 Next.js standalone、PostgreSQL、MinIO 对象存储和 Caddy
HTTPS 入口。默认域名为 `copilotcli.top`；上线前需将域名 A 记录指向服务器，在
腾讯云防火墙放行 TCP 80、443（以及可选的 UDP 443），并确保 Docker Compose
可用。PostgreSQL 与 MinIO 数据分别保存在 Docker 命名卷中。

```powershell
Copy-Item deploy/tencent/.env.server.example deploy/tencent/.env.server
# 生成 PostgreSQL、MinIO 和认证密钥；TTS 密钥可稍后补充
.\deploy\tencent\deploy.ps1
```

部署脚本通过 SSH 上传当前源码，在服务器构建镜像并启动服务。构建阶段会从现有
Vercel 站点复制当前 Android 1.8.0 APK 和 iOS 1.8.0 IPA，并校验 SHA-256；
镜像建成后下载不再依赖 Vercel。iOS OTA 安装要求 HTTPS，因此不要改成裸 IP。

安装页依赖 public/releases 下的 APK / IPA。仓库只保留图标和展示截图，不包含安装包：部署前恢复对应版本安装文件，或将下载路由改为自己的持久制品存储，否则下载接口会缺少文件。不要用空的 releases 目录覆盖正在工作的生产下载站。每次发布核对版本、大小、SHA-256 和签名，再更新发布常量。

.env.local、credentials.json、私钥、用户书籍和数据库备份禁止入库。
