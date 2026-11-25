# BookRoom Reader — Readest v0.12.20 硬分叉

BookRoom 的官方客户端。基线：`upstream` = github.com/readest/readest，tag `v0.12.20`（`28aab23e0`）。设计依据在 BookRoom 仓库 `docs/adr/0009`（硬分叉）、`0010`（多远程隔离）、`0011`（TXT 原样存储）、`0013`（书库投影）与 `docs/compatibility.md`（服务端契约）。

## 改动清单

### 1. 删除（ADR 0009）
- 支付与套餐：`libs/payment/`、`app/user/` 的套餐/结账/用量/分享链接组件、`types/payment.ts`、`types/quota.ts`、`hooks/useQuotaStats.ts`、`hooks/useAvailablePlans.ts`、`components/Quota.tsx`；`utils/access.ts` 只保留令牌与用户 ID。
- 官方后端：`src/app/api/**`、`src/pages/api/**`（由 BookRoom 服务端实现）、Supabase（`utils/supabase.ts`、`@supabase/*`）、Apple 登录插件。
- 官方云服务：分享（`app/s`、`libs/share*`）、Send to Readest（`app/send`、`services/send` 除 `conversion/`、`extensions/send-to-readest`）、Readest Voice（`libs/readestVoice`、`services/tts/providers/readest.ts`）、DeepL/Azure/Yandex 服务端翻译路由、CrossPoint 设备绑定（`app/link`、`libs/crosspoint.ts`）、统计冷归档（`libs/statsArchive.ts`）、`libs/workersWebSocket.ts`。
- 部署与遥测：OpenNext/Cloudflare（`open-next.config.ts`、`wrangler.toml`、`worker.ts`、`workers/`）、PostHog、Sentry、`scripts/upload-sourcemaps.mjs`。
- 集成：Audiobookshelf 与流式有声书播放器（`services/audiobookshelf`、`app/player`、`ABS`/`OPDSAUDIO` 格式、BookOrbit 有声书部分；本地配对音频 `services/audiobook` 保留）、RSS（`services/rss`）、网页小说导入（`services/novel`）、URL 剪藏。应用内浏览器下载（`services/webBrowser`）保留。
- 示例书架：匿名 Web 访客的 `cdn.readest.com` 示例书（`services/demoBooks.ts`、`useDemoBooks`、`data/demo/`）。
- 内置书架：「有声书」「播客」两个预设书架（内置只剩 recent/default/finished）。
- AI 网关（`/api/ai/*` 路由依赖）：保留 Ollama 与 OpenAI 兼容（OpenRouter 等）直连。
- Web 版 Edge TTS（依赖 `/api/tts/edge` 路由）：Web 版不提供，Tauri 版直连不受影响。

### 2. BookRoom 账号
- 登录页 `/auth`：服务器地址 + 用户名 + 密码 → `POST /api/v1/auth/login`；刷新 `POST /api/v1/auth/refresh`；登出 `POST /api/v1/auth/logout`。
- 服务器地址运行时可配：Tauri 版存本机；Web 版默认同源（BookRoom `WEB_DIR` 托管）。`getAPIBaseUrl()` = `<服务器>/api`。
- 令牌由 `utils/access.ts` 的 `getAccessToken()` 提供（过期前自动刷新），`AuthContext` 去掉 Supabase。

### 3. 存储 / 同步 / 代理
- `/api/sync`、`/api/sync/replicas`、`/api/sync/replica-keys`、`/api/sync/vocabulary`、`/api/storage/*` 线格式不变，只换基址。
- Web 版跨域代理全部走 BookRoom：`/api/opds/proxy`、`/api/kosync`、`/api/bookorbit`、`/api/grimmory`、`/api/hardcover/graphql`（Hardcover 令牌放 `X-Upstream-Authorization`）、`/api/notion/*`。
- Web 版构建改为静态导出（与 Tauri 相同），交给 BookRoom 托管。
- 元数据搜索在客户端直接调用 Open Library（原 `/api/metadata/search` 路由逻辑）。

### 4. TXT 原样入库（ADR 0011）
导入时对原 TXT 计算 partialMD5 并保存原文件；打开时由 `TxtToEpubConverter` 临时转换。

### 5. 多远程隔离（ADR 0010）
- 书记录新增 `remote`：`bookroom`、`local`、`webdav|gdrive|s3|onedrive|icloud`、`opds:<目录 id>`、`grimmory`、`bookorbit`。
- 同步按远程分发：原生同步只推/拉 `bookroom` 的书；网盘同步只推/拉对应后端的书；OPDS 书的进度走该目录搭配的 KOSync；Grimmory/BookOrbit 只同步属于自己的书。
- 首屏只显示当前远程的书；当前远程在设置中切换。
- 客户端配置副本只同步到 BookRoom。

### 6. 品牌与更新
应用名、标识符、关于页、自动更新地址改为 BookRoom 自己的发布地址（`github.com/fengyuanluo/bookroom-client` Releases 的 `latest.json`）。发布产物统一命名 `BookRoom_<版本>_<架构>.*`。

发布密钥（仓库 Secrets）：`TAURI_SIGNING_PRIVATE_KEY`/`_PASSWORD` 签更新包，公钥写在 `tauri.conf.json` 的 `updater.pubkey` 与 `READEST_UPDATER_PUBKEY`；`ANDROID_KEY_BASE64`/`_ALIAS`/`_PASSWORD` 签 APK。私钥丢失后已安装的客户端无法再收到更新、APK 无法覆盖安装，务必离线备份。没有 Apple 证书，macOS 包不签名。

CI（`.github/workflows`）：删除 `docker-image`、`vercel-merge`、`upload-to-r2`；`release.yml` 去掉 Discord 通知、浏览器扩展、R2 上传与 PostHog/Supabase/Sentry 注入，`latest.json` 的读写地址改为 `${{ github.repository }}`；`pull-request.yml` 去掉扩展测试与构建；`nightly.yml` 只能手动触发——它仍发布到上游的 R2，要先改成 GitHub `nightly` Release 才能恢复定时。

## 构建与验证

```bash
cd apps/readest-app
pnpm build-web                 # 静态导出到 out/（Next.js 16.4.5，16.4.2 有已公开漏洞，构建会被 Next 拦下）
BOOKROOM_WEB_DIR=$PWD/out bookroom serve   # BookRoom 同源托管：/ 打开登录页
npx tsc --noEmit -p tsconfig.json && npx biome lint . && npx biome format ../..
npx vitest run                 # 单元测试；浏览器测试另跑 vitest.browser.config.mts
```

测试约定：删除功能的用例随功能删除；契约变更（`Book.remote`、按远程同步闸门 `resolveBookSyncGate`、BookRoom 代理头 `X-Upstream-Authorization`、品牌字符串）按新契约更新。`vitest.setup.ts` 把 Node `Response.blob()` 的跨 realm Blob 包回 jsdom Blob，否则 zip.js 解出的 EPUB 封面、CBZ 页面在测试里全部损坏。
