# mprint 项目约定

## 产品与平台

- mprint 是面向 Windows 的本地打印服务，macOS 仅用于开发验证。
- Electron 桌面窗口负责服务状态、端口、托盘、开机启动和打印机列表。
- 可视化模板编辑器由本地 HTTP 服务提供，地址为 `/editor/`，使用系统默认浏览器打开；不要重新塞回 Electron 小窗口。
- 业务网页通过 `resources/sdk/mprint.js` 暴露的 `MPrint` 单入口调用打印。

## 架构边界

- `src/main`：Electron 生命周期、本地 HTTP 服务、打印队列和 Windows 打印实现。
- `src/preload`：桌面配置窗口所需的最小 IPC API。
- `src/renderer`：桌面服务配置面板，不承载模板编辑器。
- `resources/editor`：无需构建的浏览器模板编辑器静态资源。
- `resources/sdk`：业务网页使用的独立 JavaScript SDK。
- `src/shared`：主进程、preload 和桌面渲染进程共享的类型。

## 实现规则

- 本地服务只监听 `127.0.0.1`，不得改为 `0.0.0.0`。
- SDK 保持直接调用：`MPrint.print(request)`，不要增加连接或鉴权前置流程。
- 打印参数使用毫米作为布局单位；预览和实际打印必须共用同一请求结构。
- `fontFamily` 引用打印电脑已安装的字体或请求 `fonts` 数组声明的字体；编辑器通过浏览器 Local Font Access API 枚举系统字体，并始终保留手动输入回退。远程字体只接受公开 HTTPS 字体文件地址，首次下载后持久缓存到 Electron `userData/fonts`，预览和打印必须使用同一缓存文件；提供显式刷新和清除，不能把 URL 当作字体名称或在失败时静默回退。
- 浏览器编辑器不能依赖 Node.js、Electron API 或远程 CDN，确保安装后离线可用。
- 图片首版只接受 PNG、JPEG、WebP Data URL；不要让打印服务主动抓取远程 URL。
- 不记录 Token、完整图片 Data URL 或打印正文。

## 验证

- 常规修改运行 `pnpm typecheck`、`pnpm lint` 和 `git diff --check`。
- 不默认执行 build；只有明确要求时才运行 `pnpm build` 或 `pnpm build:win`。
- 打印相关改动至少验证 `/v1/health`、`/v1/printers`、`/v1/preview` 和编辑器静态资源。
- 正式交付前必须在 Windows 真机验证打印机枚举、静默打印、份数、纸张尺寸、开机启动、托盘和安装包。
