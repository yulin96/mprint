---
name: mprint
description: 面向 Windows 本地打印服务与浏览器模板编辑器的测量型操作工作台
colors:
  paper: '#fafafa'
  paper-bright: '#ffffff'
  ink: '#24211c'
  ink-soft: '#625d54'
  line: '#d9d2c7'
  line-strong: '#b8afa2'
  coral: '#ed684f'
  coral-dark: '#bf4633'
  coral-soft: '#fff0eb'
  green: '#267451'
  green-soft: '#e5f3eb'
  danger: '#a6382c'
  editor-surface: 'rgba(255, 255, 255, 0.86)'
  editor-muted: '#6b655c'
  editor-line: '#dedbd4'
  editor-line-strong: '#b8b2a8'
  editor-coral: '#ff6248'
  editor-coral-soft: '#fff0ec'
  glow-amber: '#ffd78d'
  glow-coral: '#ffb6a6'
typography:
  display:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: 'clamp(40px, 5vw, 64px)'
    fontWeight: 400
    lineHeight: 1
    letterSpacing: '-0.03em'
  brand:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: '28px'
    fontWeight: 700
    lineHeight: 1
    letterSpacing: '-0.02em'
  page-title:
    fontFamily: "'Microsoft YaHei UI', 'PingFang SC', 'Segoe UI', sans-serif"
    fontSize: '20px'
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 'normal'
  headline:
    fontFamily: "'Microsoft YaHei UI', 'PingFang SC', 'Segoe UI', sans-serif"
    fontSize: '18px'
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 'normal'
  title:
    fontFamily: "'Microsoft YaHei UI', 'PingFang SC', 'Segoe UI', sans-serif"
    fontSize: '14px'
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 'normal'
  body:
    fontFamily: "'Microsoft YaHei UI', 'PingFang SC', 'Segoe UI', sans-serif"
    fontSize: '13px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  label:
    fontFamily: "'Microsoft YaHei UI', 'PingFang SC', 'Segoe UI', sans-serif"
    fontSize: '11px'
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 'normal'
  code:
    fontFamily: "'Cascadia Code', 'SFMono-Regular', Consolas, monospace"
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 'normal'
rounded:
  field: '8px'
  action: '10px'
  launch: '11px'
  brand: '12px'
  panel: '14px'
  workspace: '16px'
  pill: '999px'
spacing:
  xs: '6px'
  sm: '8px'
  md: '10px'
  lg: '14px'
  xl: '16px'
  2xl: '20px'
  3xl: '24px'
  4xl: '28px'
  5xl: '32px'
  6xl: '34px'
  7xl: '40px'
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '#ffffff'
    typography: '{typography.body}'
    rounded: '{rounded.action}'
    padding: '0 15px'
    height: '38px'
  button-secondary:
    backgroundColor: 'rgba(255, 255, 255, 0.75)'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.action}'
    padding: '0 15px'
    height: '38px'
  editor-launch:
    backgroundColor: '{colors.ink}'
    textColor: '#ffffff'
    typography: '{typography.body}'
    rounded: '{rounded.launch}'
    padding: '14px 16px'
  status-running:
    backgroundColor: '{colors.green-soft}'
    textColor: '{colors.green}'
    typography: '{typography.body}'
    rounded: '{rounded.pill}'
    padding: '8px 13px'
  input-editor:
    backgroundColor: '{colors.paper-bright}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.field}'
    padding: '0 9px'
    height: '35px'
  editor-workspace:
    backgroundColor: 'rgba(255, 255, 255, 0.72)'
    textColor: '{colors.ink}'
    rounded: '{rounded.workspace}'
    height: 'calc(100vh - 124px)'
  layer-selected:
    backgroundColor: '{colors.editor-coral-soft}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.field}'
    padding: '7px 10px'
    height: '39px'
  paper-preview:
    backgroundColor: '{colors.paper-bright}'
    textColor: '{colors.ink}'
    rounded: '0px'
    width: '600px'
    height: '380px'
---

# Design System: mprint

## Overview

**Creative North Star: "光晕中的校准工作台"**

mprint 用一套连续的视觉系统连接两个职责明确的表面：Electron 桌面窗口是本地服务的配置面板，系统浏览器中的 `/editor/` 是容纳完整模板工作的宽阔画布。两者共享近白网格、深墨信息骨架和珊瑚校准标记，但不假装是同一个页面；桌面端负责状态、打印机和入口，浏览器端负责纸张、元素、属性、图层与打印结果。

整体气质明亮、精确、克制。全局 `#fafafa` 背景覆盖 32px 细网格，左上暖黄与右下珊瑚的低透明模糊光晕只提供环境温度；白色半透明表面和珊瑚细边界承载主要工作区。编辑器保持左侧紧凑控制、右侧大画布的稳定关系，白色直角纸张从 20px 测量网格与标尺上浮起。

**Key Characteristics:**

- Electron 配置面板与系统浏览器编辑器职责分离、视觉连续。
- `#fafafa` 全局底色上叠加 32px 细网格。
- 左上暖黄、右下珊瑚的低透明模糊环境光晕。
- 白色半透明工作表面、珊瑚细边界和深墨文字。
- 编辑器标题右侧紧邻纸张入口和一级“打印机默认纸张”开关；纸张弹层只承载尺寸与方向。左侧只保留元素、图层和元素属性，右侧为定位工具、20px 测量网格、标尺和白纸。
- Windows 系统中文字体为主，参数、地址和尺寸使用等宽字体。
- 状态有文字与结构反馈，无装饰性动效。

## Colors

色彩以近白工作底、实体白纸和深色油墨建立可靠对比，暖黄与珊瑚只在背景气氛和操作校准点中出现。

### Primary

- **桌面校准珊瑚（`coral`）**：用于 Electron 配置面板的主要容器边界、版本徽标与聚焦提示。
- **编辑器校准珊瑚（`editor-coral`）**：浏览器编辑器中更鲜明的工作区边界、选中轮廓和复选框强调。
- **深珊瑚（`coral-dark`）**：用于添加元素等珊瑚交互的文字反馈。
- **桌面珊瑚薄层（`coral-soft`）** 与 **编辑器珊瑚薄层（`editor-coral-soft`）**：分别承载两套表面的轻量选中或错误底色。

### Secondary

- **运行绿（`green`）**：只表示服务运行、保存成功和默认打印机等已确认的正常状态。
- **运行绿薄层（`green-soft`）**：在 Electron 状态徽标中承载绿色语义。

### Tertiary

- **故障红（`danger`）**：用于错误消息和删除动作，必须邻近出错或危险操作出现。
- **环境暖黄（`glow-amber`）**：只用于左上角模糊光晕，不进入控件或状态语义。
- **环境浅珊瑚（`glow-coral`）**：只用于右下角模糊光晕，不替代主珊瑚。

### Neutral

- **全局近白（`paper`）**：两个表面的全局背景与 32px 网格底。
- **实体白（`paper-bright`）**：输入、纸张和必要的实白表面。
- **半透明白面（`editor-surface`）**：浏览器编辑器的轻透表面层。
- **油墨黑（`ink`）**：正文、标题、关键边界和主操作。
- **桌面柔墨（`ink-soft`）** 与 **编辑器柔墨（`editor-muted`）**：各自页面中的说明、单位和元数据。
- **桌面铅线（`line` / `line-strong`）** 与 **编辑器铅线（`editor-line` / `editor-line-strong`）**：分别定义内部层级和可交互边界，不跨文件互换近似值。

**The Two-Surface Token Rule.** 两个页面共享视觉语义，但桌面与编辑器的珊瑚、柔墨和铅线值按各自样式表生效；不要为了表面一致而擅自合并近似 token。

**The Ambient-Only Glow Rule.** 暖黄和浅珊瑚只能以低透明、高模糊背景光出现，不得成为按钮、徽标、文字或边框颜色。

**The White Sheet Rule.** 实体白是输入和打印介质的清晰基准；纸张必须保持不透明纯白，不受环境光晕染色。

**The Default Printer Paper Rule.** `useDefaultPageSize` 是纸张入口旁的一级开关，不藏入弹层。启用时必须明确说明打印机接管实际纸张尺寸，而模板宽高仍负责编辑坐标与预览，避免把“打印纸张”和“模板画布”混为一谈。

## Typography

**Display Font:** Georgia（回退到 Times New Roman 与系统衬线字体）  
**Body Font:** Microsoft YaHei UI（回退到 PingFang SC、Segoe UI 与系统无衬线字体）  
**Label/Mono Font:** Cascadia Code（浏览器编辑器局部回退到 Consolas 与系统等宽字体）

**Character:** Electron 配置面板用衬线品牌名与大号服务状态制造“打印样张”信号；浏览器编辑器回到紧凑的系统中文无衬线标题，把注意力留给画布。地址、SDK 代码、毫米尺寸和图层编号使用等宽字体，帮助扫描与比较精确参数。

### Hierarchy

- **Display**（400，`clamp(40px, 5vw, 64px)`，行高 1）：只用于 Electron 中需要一眼确认的服务状态。
- **Brand**（700，28px，行高 1）：只用于 Electron 的 mprint 品牌名。
- **Page Title**（700，20px，行高 1.5）：浏览器编辑器标题，保持工具型而非展示型。
- **Headline**（700，18px，行高 1.5）：Electron 配置区块标题。
- **Title**（700，14px，行高 1.5）：编辑器属性区标题和紧凑分组标题。
- **Body**（400，13px，行高 1.5）：说明、列表与按钮；长说明控制在约 62ch 内。
- **Label**（700，11px，行高 1.5）：字段名、徽标、单位与紧凑元数据。
- **Code**（400，12px，行高 1.7）：SDK 示例、端点、系统名称与精确数值。

**The Surface Hierarchy Rule.** Electron 可以用衬线放大服务状态，浏览器编辑器必须使用紧凑系统字标题；不要把展示型衬线标题带入属性面板。

**The Measured Data Rule.** 地址、代码、毫米尺寸和层级编号使用等宽字体，帮助扫描和对齐可测试参数。

## Layout

Electron 配置面板最小宽度为 920px，外壳最大宽度 1400px，默认内边距为顶部 20px、左右与底部 40px。服务总览使用约 1.6:0.8 的两列：左侧显示服务状态、端点和“打开模板编辑器”入口，右侧保留启动设置；打印机与 SDK 示例在其下按区块纵向展开。窗口收紧到 1050px 以下时，左右内边距降为 28px，服务列比调整为 1.2:0.8。

浏览器编辑器最小宽度为 1080px，外壳最大宽度 1680px，默认内边距为顶部 24px、左右与底部 34px。工作区高度为视口减 124px且不低于 560px；常规高度下页面外层不滚动，只有视口高度低于 680px 时才允许页面外层滚动。左侧检查器宽度在 390–430px 之间，右侧画布至少 620px。检查器独立纵向滚动，只按元素、图层、元素属性排列；位置与尺寸折叠在属性高级项中。纸张设置位于顶部弹层，选中元素的快速定位位于画布上下文工具栏。

在 1250px 以下，编辑器左栏固定为 390px，右栏继续占满剩余空间，顶部状态消息可隐藏以保护主操作空间。全局页面网格间距为 32px；画布内部测量网格为 20px，顶部标尺高 27px、左侧标尺宽 36px，两套网格不能混用。

**The Two-Surface Responsibility Rule.** Electron 只承载服务配置和编辑器入口；模板编辑必须在系统浏览器的大画布中完成，不能重新塞回桌面窗口。

**The Control-and-Result Rule.** 浏览器编辑器的配置、属性和图层留在左侧，纸张结果持续留在右侧；不要让检查器覆盖或替换纸张预览。

**The Two Centers Rule.** “快速定位”的水平居中、垂直居中和页面中心控制选中元素框相对纸张的位置；文本属性 `verticalAlign` 的顶部、居中和底部控制文字内容在自身文本框内的垂直对齐。两种“居中”必须分别表达，不能混成一个不明确的操作。

**The Open Topbar Rule.** Electron 顶栏依靠留白和下方内容分组建立层级，不增加多余的底边线。

## Elevation & Depth

系统用三层深度构成：最底层是近白网格与模糊暖色环境光，中层是带轻微透明度和珊瑚边框的服务面板或编辑工作区，最高层是白色纸张与关键深色按钮。普通列表、字段和分区仍以 1px 铅线组织，不逐层堆叠阴影。

### Shadow Vocabulary

- **环境光晕**（桌面 520px / 0.24，编辑器 560px / 0.26，`filter: blur(110px)`）：固定在左上和右下，只提供背景温度，不响应交互。
- **工作区环境浮层**（`0 24px 70px rgba(78, 61, 47, 0.08)`）：用于 Electron 服务总览和浏览器编辑工作区，与网格背景轻微分离。
- **纸张浮起**（`0 22px 58px rgba(67, 58, 46, 0.2)`）：只用于浏览器编辑器中的实体纸张。
- **主操作抬升**（桌面 `0 7px 18px rgba(36, 33, 28, 0.16)`；编辑器 `0 8px 22px rgba(36, 33, 28, 0.16)`）：只用于深色主按钮。

**The Atmospheric Depth Rule.** 光晕属于背景环境，阴影属于工作区、纸张和主要提交动作；不要让光晕穿透纸张或给普通表单控件制造漂浮层级。

## Shapes

形状来自办公设备与裁切纸张。字段和图层项使用 8px 圆角，主次按钮使用 10px，Electron 的编辑器入口使用 11px，品牌标记使用 12px，桌面服务面板使用 14px，浏览器大工作区使用 16px。状态与版本徽标为胶囊形，环境光晕为圆形；纸张和纸上打印元素保持直角。

结构边界统一为 1px 实线：桌面和编辑器各自使用其铅线 token，主要工作区使用对应的珊瑚边界。选中打印元素在珊瑚边框外增加 2px 半透明轮廓，以区别纸张内容与应用控件。

**The Square Paper Rule.** 应用容器可以温和圆润，打印纸张与纸上元素必须保持真实裁切的直角。

## Components

组件紧凑、直接、状态明确。两个表面共享交互语法，但以各自页面的 token 和尺寸为准。

### Buttons

- **Shape:** 通用主次按钮高 38px、10px 圆角；Electron 内横向内边距 16px，浏览器编辑器为 15px。
- **Primary:** 油墨黑底、白字、1px 同色边框和轻量抬升，用于保存设置与测试打印。
- **Hover / Focus:** 桌面深色按钮悬停变为纯黑；键盘聚焦统一使用 3px 半透明珊瑚轮廓并外移 2px。没有装饰性过渡，反馈立即发生。
- **Secondary:** Electron 使用透明底，浏览器编辑器使用 0.75 透明白底；两者都用深铅线边框，并在悬停时加深到油墨黑。
- **Editor Launch:** Electron 中唯一的整行深色入口，展示“打开模板编辑器”、本地 URL 和外跳箭头；它是页面跳转而非页签切换。
- **Text Danger:** 删除动作保持透明无边框，以故障红文字表达危险性。

### Chips

- **Style:** Electron 的服务状态、版本和默认打印机使用胶囊形。运行状态为绿色文字与浅绿底，错误状态为故障红文字与珊瑚薄层底，等待状态为中性暖灰底。
- **State:** 状态点、状态文字和底色同时变化；版本徽标使用珊瑚实底与白字，但不代表成功或错误。

### Cards / Containers

- **Corner Style:** Electron 服务总览为 14px，浏览器编辑工作区为 16px。
- **Background:** 两者都使用半透明白色表面，让全局细网格和环境光保持隐约可感；编辑器检查器使用更接近不透明的近白层。
- **Shadow Strategy:** 主要工作区使用同一环境浮层阴影，普通内部区块无阴影。
- **Border:** 两个主要工作区都使用各自页面的 1px 珊瑚边界；内部区域使用铅线分隔。
- **Internal Padding:** Electron 服务主区为 30px × 32px；浏览器检查器分区为 15px × 17px。

### Inputs / Fields

- **Style:** 实体白底、1px 深铅线、8px 圆角；浏览器属性字段高 35px，Electron 端口输入高 42px。
- **Focus:** 3px 半透明珊瑚轮廓加 2px 外偏移，不以阴影代替聚焦可见性。
- **Error / Disabled:** 错误消息使用故障红并靠近对应操作；禁用按钮降至约 0.55 不透明度并使用等待光标。

### Navigation

Electron 不使用内部页签切换编辑器。“打开模板编辑器”通过本地 HTTP 地址进入系统默认浏览器；Electron 顶栏不使用底边线。浏览器编辑器的顶部栏包含上下文标题、纸张设置弹层、状态消息、复制、预览和测试打印操作，不提供多级导航。

### Browser Editor Workspace

浏览器编辑器的标志性容器采用 16px 圆角、半透明白底、1px 鲜珊瑚边框和轻环境阴影。左侧检查器以分隔线连续组织元素、图层与元素属性，右侧画布保持最大剩余宽度；纸张设置从顶部按钮展开，定位工具只在选中元素时显示于画布上方。这是一个完整工作区，不拆成卡片墙。

### Measured Paper Stage

右侧画布使用 20px 暖灰测量网格，顶部和左侧标尺围住中央白色直角纸张。默认纸张预览为 600 × 380px，再根据毫米尺寸缩放；选中元素使用 1px 编辑器珊瑚边框与 2px 半透明外轮廓。纸张尺寸和拖动提示固定在画布底边，不覆盖打印内容。

### Layer List

图层项默认透明、无边框；悬停仅增加浅暖底色，选中后同时出现编辑器珊瑚边框与珊瑚薄层背景。名称用紧凑正文并省略溢出，层级编号和元素元数据使用等宽小字。

## Do's and Don'ts

### Do:

- **Do** 让 Electron 首屏直接显示服务状态、端点、打印机和浏览器编辑器入口。
- **Do** 在两个表面维持相同的 32px 全局网格、对角环境光和深墨信息骨架。
- **Do** 保持浏览器编辑器“左侧控制、右侧结果”的稳定结构，并让检查器独立滚动。
- **Do** 让左栏只承担元素、图层和当前属性，把纸张配置放在顶部，把选中元素定位放在画布上下文中。
- **Do** 明确区分元素框相对纸张居中与文字内容在自身文本框内垂直居中。
- **Do** 区分全局 32px 背景网格与画布 20px 测量网格及标尺。
- **Do** 对成功、错误、等待和选中状态同时提供文字、色彩与边界提示。
- **Do** 把地址、代码、毫米尺寸和图层编号交给等宽字体。

### Don't:

- **Don't** 在 Electron 窗口内重建模板编辑器，或用内部页签代替系统浏览器入口。
- **Don't** 把暖黄与浅珊瑚光晕用于控件、文字、徽标或纸张内容。
- **Don't** 用大面积实色珊瑚、强渐变或装饰插画稀释校准重点。
- **Don't** 给普通卡片、列表项和输入框增加阴影或漂浮动效。
- **Don't** 给 Electron 顶栏增加没有信息分组作用的底边线。
- **Don't** 把纸张做成圆角卡片，或让检查器覆盖打印结果。
- **Don't** 只用红绿颜色表达运行或错误状态，必须保留可读文字。
