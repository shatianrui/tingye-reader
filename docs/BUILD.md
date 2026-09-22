# CLI 构建与部署

## Android APK

在 apps/android 工作。要求 Node.js 22、JDK 17、Android SDK（平台及 NDK 版本以 android/build.gradle、Gradle 配置为准）、PowerShell 7。android/ 是包含定制功能的正式原生工程，必须保留；不要执行覆盖它的 clean prebuild。

设置 JAVA_HOME、ANDROID_HOME（或 ANDROID_SDK_ROOT）。签名使用原应用的私有 keystore，配置环境变量：

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

在 apps/ios 工作。Windows 使用 EAS CLI 云构建；本地 Xcode 构建需要 macOS。原 EAS 项目关联保留，执行者需有项目权限。

```powershell
cd apps/ios
npm ci
npm run typecheck
npm test
npx eas-cli@24.6.0 login
# 复制 credentials.example.json 为 credentials.json，填入实际证书路径和密码
npm run build:ipa
```

preview 使用本地提供的设备签名配置，描述文件必须包含设备 UDID，并与证书、Bundle ID 相符。商店签名使用 `pwsh -File tools/build-device.ps1 -Profile production`。两种签名不能混用。CLI 等待构建并显示产物链接；使用 -NoWait 仅提交。

没有本地证书文件、但这个 EAS 项目此前已经用 Expo 托管凭据构建过时，可用 `pwsh -File tools/build-device.ps1 -Profile production-remote`：跳过 credentials.json，直接用 EAS 服务端保存的证书和描述文件（`eas.json` 里对应 `production-remote` 档位，未设置 `credentialsSource`，默认走 remote）。如果这个 app 从未托管过凭据，remote 档位会在非交互模式下失败，此时仍需本地证书或先在有 Apple 账号交互权限的机器上跑一次 `eas credentials` 完成首次托管设置。App Store Connect API 密钥（.p8）不能替代这里的证书——那是 `eas submit` 提交商店用的凭据，跟出包签名是两回事。

保留 eas-build-post-install 钩子：它选择正式入口并应用 expo-audio 的 iOS 时钟修复。verification/index.tsx 仅用于模拟器样例。EAS 使用远端 build number 自动递增，以构建详情为准。TestFlight 使用 `npx eas-cli@24.6.0 submit --platform ios`，通过 CLI 配置 App Store Connect 凭据，私钥不入库。

## 网站 / Vercel

apps/web/.env.example 列出配置。数据库使用 Supabase PostgreSQL，书籍存储在私有 tingye-books 桶。首次部署检查 db/ 和 scripts/migrate.mjs，再执行 `npm run db:migrate`；邀请注册使用 `npm run invite:create`。迁移会修改数据库，先核对目标环境。

```sh
cd apps/web
npm ci
npm test
npm run build
```

Vercel 项目 Root Directory 设置为 apps/web；将 .env.example 对应变量填入 Vercel 环境配置。也可在该目录使用 Vercel CLI link / deploy。此次导入未修改现有生产项目 Git 关联，也未触发部署。

安装页依赖 public/releases 下的 APK / IPA。仓库只保留图标和展示截图，不包含安装包：部署前恢复对应版本安装文件，或将下载路由改为自己的持久制品存储，否则下载接口会缺少文件。不要用空的 releases 目录覆盖正在工作的生产下载站。每次发布核对版本、大小、SHA-256 和签名，再更新发布常量。

.env.local、credentials.json、私钥、用户书籍和数据库备份禁止入库。db/supabase-ca.json 是验证数据库 TLS 的公开 CA，不是服务端密钥。

## GitHub Actions 构建 APK / IPA

`.github/workflows/build-mobile.yml` 手动触发（Actions 页 Run workflow），不随 push/PR 自动运行。Android 任务跑在 windows-latest（build-local.ps1 依赖 gradlew.bat），iOS 任务跑在 macos-latest 上直接用 Xcode 出包（不再经过 EAS/expo.dev，不需要 `EXPO_TOKEN`）：先 `expo prebuild` 现生成 `ios/` 原生工程（同 `.gitignore` 里 `/ios` 是生成产物的约定），再用 `xcodebuild archive`/`-exportArchive` 打包。两个任务各自先执行 npm ci、typecheck、test，再构建；失败会中止，不会用未通过测试的源码出包。

`android_unsigned` 输入设为 true 时跳过 keystore 相关 secrets，直接用 `tools/build-local.ps1 -Unsigned` 出未签名 APK（产物为 releases/app-unsigned.apk），仅供本机安装测试，不能覆盖已签名安装的正式版本。iOS 对应 `ios_profile` 的 `unsigned`（默认值）：完全跳过证书/描述文件，`xcodebuild archive` 加 `CODE_SIGNING_ALLOWED=NO` 出未签名 `.app`，再手工打包成 `releases/app-unsigned.ipa`（Payload/ 结构），适合用自己的签名工具（Sideloadly/AltStore/TrollStore 等）在本机重新签名后安装，不能直接装机。`ios_profile` 设为 `adhoc` 或 `appstore` 时才需要真实 Apple 证书，在 runner 上建临时 keychain 导入证书、安装描述文件后用 `xcodebuild` 正式签名出包（`adhoc` 对应内部测试描述文件，`appstore` 对应商店/TestFlight 描述文件）。

运行前在仓库 Settings → Secrets and variables → Actions 配置：

- Android 签名：`ANDROID_KEYSTORE_BASE64`（release keystore 文件的 base64，例如 `base64 -w0 your.keystore`）、`ANDROID_KEY_ALIAS`、`ANDROID_STORE_PASSWORD`、`ANDROID_KEY_PASSWORD`。必须是原应用签名的同一把 keystore，否则产物无法覆盖安装线上版本。
- iOS 签名（仅 `ios_profile` 为 `adhoc`/`appstore` 时需要）：`IOS_DISTRIBUTION_CERTIFICATE_BASE64`（distribution.p12 的 base64）、`IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`、`IOS_PROVISIONING_PROFILE_BASE64`（.mobileprovision 的 base64，需与证书、Bundle ID 相符；appstore 用商店签名描述文件，adhoc 描述文件需包含目标设备 UDID）。

任一签名密钥缺失时对应任务会在解密/构建前明确报错，不会用空值静默构建出无效或未签名产物。产物通过 workflow 的 Artifacts 下载；`create_release` 输入设为 true 时会额外把两端产物打包发布到一个新建的 GitHub Release（默认关闭，避免每次调试运行都产生公开发布）。密钥文件只落在 runner 的临时目录和临时 keychain 里，iOS 任务结束时会清理证书、描述文件和 keychain；不要把这些密钥写回仓库或工作流以外的地方。
