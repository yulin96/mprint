# mprint

mprint 是一个面向 Windows 的本地打印服务。程序常驻系统托盘，在 `127.0.0.1` 启动 HTTP 服务；业务网页引入 JavaScript SDK 后，可直接调用 Windows 打印机。

项目地址：[github.com/yulin96/mprint](https://github.com/yulin96/mprint)

## 功能

- 一个 API 直接打印：`MPrint.print(request)`
- 获取 Windows 打印机列表
- 支持 A3/A4/A5/A6、照片纸和自定义毫米纸张
- 支持毫米定位的文字、Data URL 图片、对齐、旋转和打印份数
- 浏览器模板编辑器：配置纸张和元素、实时预览、拖动定位、图层切换、快速居中、复制调用代码
- Windows 登录后自动启动、关闭到托盘和可配置服务端口

## 使用模板编辑器

启动 mprint 后，在桌面配置面板点击“打开模板编辑器”。程序会使用系统默认浏览器打开：

```text
http://127.0.0.1:17653/editor/
```

编辑器顶部配置纸张，并提供一级“打印机默认纸张”开关；左侧管理元素、图层和属性，右侧实时显示打印结果。完成后点击“复制当前代码”，即可把生成的 `MPrint.print(...)` 调用粘贴到业务项目中。

文字元素的字体支持直接输入本机字体名称。在桌面版 Chrome 或 Edge 中，也可以点击“读取系统字体”，授权后从系统字体列表选择。编辑器的“远程字体”区域可以添加字体名称、HTTPS 字体链接、字重和格式，并通过“验证加载”确认编辑画布可用；声明成功的字体会出现在文字元素的字体候选中。远程字体通过打印请求的 `fonts` 数组传递，文字元素继续使用 `fontFamily` 引用字体名称；不要把字体 URL 直接填写到 `fontFamily`。

## 网页调用

默认端口为 `17653`：

```html
<script src="http://127.0.0.1:17653/mprint.js"></script>
<script>
  await MPrint.print({
    page: 'A4',
    fonts: [
      {
        fontFamily: 'Example Font',
        src: 'https://static.example.com/fonts/example.woff2',
        fontWeight: 400,
        format: 'woff2'
      }
    ],
    texts: [
      {
        content: '测试打印',
        xMm: 20,
        yMm: 20,
        widthMm: 80,
        heightMm: 12,
        fontFamily: 'Example Font',
        align: 'center',
        verticalAlign: 'middle'
      }
    ],
    printer: {
      silent: true,
      copies: 1,
      useDefaultPageSize: false
    }
  })
</script>
```

`fonts` 最多声明 10 个远程字体文件。`src` 只支持不包含账号密码的 HTTPS 直接字体文件地址；远程服务器必须允许跨域字体访问。`format` 可省略，也可以填写 `woff2`、`woff`、`truetype` 或 `opentype`。同一字体的不同字重需要分别声明。字体加载失败或超过 15 秒时，预览和打印都会报错，不会静默替换为其他字体。远程字体依赖网络可用性，当前版本不会把字体持久化到本地。

`printer.useDefaultPageSize` 为 `true` 时，不向 Windows 打印机指定纸张尺寸，由打印机当前默认配置决定；`page` 仍用于模板坐标、编辑和预览。

SDK API：

- `MPrint.print(request)`：提交打印任务。
- `MPrint.preview(request)`：打开独立打印结果预览。
- `MPrint.getPrinters()`：读取打印机列表。
- `MPrint.health()`：读取本地服务状态。
- `MPrint.configure({ port })`：连接非默认端口。

HTTPS 业务页面建议把 `resources/sdk/mprint.js` 部署到自己的 HTTPS 静态资源域名，SDK 仍请求本机 `http://127.0.0.1`。Chrome/Edge 可能要求用户允许网站访问本地网络。

## 本地接口

```text
GET  /editor/
GET  /mprint.js
GET  /v1/health
GET  /v1/printers
POST /v1/preview
POST /v1/print
```

服务只监听 `127.0.0.1`。当前版本面向内部环境，不要求 Token 或 Origin 审批；仍保留 JSON 参数校验、25MB 请求上限、最多 20 张图片、200 个文字项和 5 份打印限制。

## 开发

环境要求：Node.js 22、pnpm 11。

```bash
pnpm install
pnpm dev
```

非破坏性检查：

```bash
pnpm typecheck
pnpm lint
```

Windows 打包：

```bash
pnpm build:win
```

打包产物由 electron-builder 生成。日常开发和代码审查不需要执行打包命令。

## 平台说明

正式目标是 Windows。macOS 可用于开发界面、本地 HTTP 服务和预览流程，但不能替代 Windows 打印驱动、静默打印、开机启动和安装包验证。
