# 听页 Tingye Reader

网站、Android 与 iOS 的维护仓库。生产网站 https://tingye-reader.vercel.app 。移动端使用 React Native / Expo 原生阅读界面，共用网站的账号、书籍备份、阅读进度和云端语音接口。

## 工程结构

| 目录 | 内容 | 导入基线 |
| --- | --- | --- |
| `apps/web` | Next.js 网站、API、数据库迁移 | 2026-09-20 生产站对应源码 |
| `apps/android` | React Native、原生 Android、折叠屏和 DeX | 1.6.5 / 16006 |
| `apps/ios` | React Native、iOS 文档及语音模块、跨端进度修复 | 1.7.8 / 34 |
| `docs` | 构建、发布及维护说明 | — |

各工程保留独立 package-lock.json，在对应目录运行 npm。两端不是完全相同的代码版本：云端备份/同步核心（library.ts、native-library.ts）已在双端统一并测试；iOS 仍领先于朗读跟读高亮等阅读器修复，维护时应逐项移植并测试，不能直接覆盖整个目录。

## 快速开始

要求 Node.js 22.13 或更新的 22.x、npm、Git。移动端使用 Expo SDK 57；修改前阅读对应版本文档和各工程 AGENTS.md。

```sh
cd apps/web
npm ci
# 将 .env.example 复制为 .env.local，填写自己的数据库、存储和服务端密钥
npm run dev
```

网站默认 http://localhost:5174 。客户端接口配置在各端 src/tingye，搜索 tingye-reader.vercel.app 可找到生产地址。生产 API 密钥只配置在服务端。

每个工程运行 `npm ci`、`npm run typecheck`、`npm test`。网站首次类型检查前执行 `npx next typegen`。GitHub Actions 分别检查三端源码，不访问生产数据库、不提交商店构建。

详见 [CLI 构建与部署](docs/BUILD.md)、[维护与同步检查](docs/MAINTENANCE.md)。签名材料、用户数据与安装包不在源码仓库内。
