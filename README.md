# AI Chat

一个面向多模型对话场景的前端聊天应用，聚焦于更接近实际产品形态的 AI 使用体验：模型切换、深度思考开关、图片理解、多会话管理、主题切换、分享截图和移动端适配都已经内置。

## 在线体验

- 体验地址: http://118.31.167.0:3000/ai


## 项目简介

`AI Chat` 是一个基于 React + Vite + TypeScript 构建的 AI 对话前端项目，适合作为聊天产品原型、内部 AI 助手前台、或者接入自有大模型网关的 Web 界面。

项目当前重点不是“最小 demo”，而是更完整的交互闭环：

- 支持动态获取模型列表并切换模型
- 支持展示模型能力标签，如图片理解、深度思考、流式响应
- 支持图片上传并以多模态 `messages` 格式发起对话
- 支持深度思考开关，并在会话请求中透传 `thinking: true / false`
- 支持本地会话记录、重命名、置顶、删除、导入、导出
- 支持中英文语言切换与亮暗主题切换
- 支持聊天内容截图分享与移动端体验优化

## 功能特性

### 1. 多模型对话

- 模型列表通过接口动态拉取
- 支持切换不同模型会话
- 模型卡片可展示以下能力标签
  - `流式 / 非流式`
  - `图片理解`
  - `深度思考`
  - `未启用`

### 2. 图片理解与附件上传

- 对支持图片理解的模型，前端仅允许上传图片文件
- 上传完成后使用后端返回的 OSS 地址发起多模态消息
- 用户消息会在会话区展示已上传图片内容
- 会话结束后自动清空本次上传附件，避免误复用

### 3. 深度思考模式

- 对支持 `supportsThinking` 的模型，输入框可切换“深度思考”
- 请求体会自动带上：

```json
{
  "thinking": true
}
```

- 前端会展示模型返回的 `reasoning_content`

### 4. 会话管理

- 新开对话
- 历史会话列表
- 会话重命名
- 会话置顶 / 取消置顶
- 删除单个会话 / 删除全部会话
- 本地导出 JSON
- 导入历史会话

### 5. 交互体验

- 支持 `Enter` 快捷发送，`Shift + Enter` 换行
- 支持流式输出
- 支持重新生成上一轮回答
- 支持滚动到底部快捷按钮
- 支持聊天内容截图分享
- 支持主题切换动画
- 支持移动端欢迎态与聊天区适配

### 6. 国际化与主题

- 支持中文 / 英文切换
- 支持亮色 / 暗色主题
- 主题切换带右上角向全屏扩散的过渡动画

## 技术栈

- React 19
- TypeScript
- Vite 6
- React Router 7
- react-markdown
- remark-gfm
- highlight.js
- html2canvas-pro
- uuid

## 页面路由

- `/ai`: 主聊天页面

## 本地启动

### 1. 安装依赖

```bash
npm install
npm install --prefix end
```

### 2. 启动开发环境

```bash
npm run dev --prefix end  # 终端一：后端，自动重载代码
npm run dev               # 终端二：前端
```

后端需要 Node.js 22.13+，在 `end/.env` 配置 `DEEPSEEK_API_KEY` 或 `DASHSCOPE_API_KEY`。详见 [后端说明](./end/README.md)。

启动后访问：

- http://localhost:5174/ai
- 端口被占用时使用 `npm run dev -- --host 127.0.0.1 --port 5175`，访问 http://127.0.0.1:5175/ai。
- 修改后端时使用上述 `dev` 命令；`npm start --prefix end` 不会自动加载代码变更。

### 3. 生产构建

```bash
npm run build
```

### 4. 本地预览构建产物

```bash
npm run preview
```

## 环境配置

项目通过 `VITE_CHAT_BASE_URL` 指定聊天接口地址。

可在根目录创建对应环境文件，例如：

```bash
.env.development
```

写入：

```env
VITE_CHAT_BASE_URL=http://localhost:3001/api/chat/completions
```

说明：

- 聊天请求会直接发送到 `VITE_CHAT_BASE_URL`
- 模型列表接口会基于该地址自动推导为 `/api/models`
- 文件上传接口会基于该地址自动推导为 `/api/files/upload`

也就是说，如果聊天接口配置为：

```env
VITE_CHAT_BASE_URL=http://localhost:3001/api/chat/completions
```

则前端会自动请求：

- `http://localhost:3001/api/chat/completions`
- `http://localhost:3001/api/models`
- `http://localhost:3001/api/files/upload`

## 接口能力约定

前端当前已经接入以下模型能力字段：

- `supportsStream`
- `supportsFileUpload`
- `supportsThinking`
- `supportsVision`
- `supportsImageUnderstanding`
- `supportsImageUrl`
- `modalities`
- `inputModalities`
- `capabilities`

适合对接一个统一的大模型网关，由后端负责下发模型能力配置。

## 推荐的模型返回能力示例

```json
{
  "id": "gpt-4o",
  "name": "GPT-4o",
  "provider": "openai",
  "description": "适合通用对话与图片理解",
  "supportsStream": true,
  "supportsThinking": true,
  "supportsVision": true,
  "enabled": true
}
```

## 项目结构

详细分层与多智能体扩展约定见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

```text
src/
├── app/               # 应用装配与全局 Provider
├── pages/             # 路由页面
├── features/          # chat 与 agents 业务域
├── shared/            # 通用组件、hooks、工具、类型、资源
└── infrastructure/    # 外部服务适配
```

## 适用场景

- 企业内部 AI 助手前端
- 多模型聚合聊天界面
- 大模型网关控制台前台
- AI 产品原型验证
- 图片理解 + 推理问答场景

## 当前亮点

- 不只是基础聊天框，而是接近真实产品的交互形态
- 支持模型能力驱动 UI 展示
- 支持多模态消息结构适配
- 支持本地会话资产管理
- 支持主题与语言切换

## 后续可继续扩展的方向

- 接入真正的 i18n 资源拆分方案
- 增加用户配置中心
- 支持 Markdown 附件、PDF、文档类上传
- 支持服务端会话持久化
- 增加权限体系与多用户支持
- 增加埋点与观测能力

## 开发说明

如果你准备基于这个项目继续扩展，建议优先关注以下部分：

- `src/features/chat/index.tsx`
  - 聊天主流程
  - 模型能力判断
  - 上传与会话请求拼装
- `src/app/providers/ChatContext.tsx`
  - 会话列表与消息状态管理
- `src/app/providers/ThemeContext.tsx`
  - 主题切换与动画
- `src/app/providers/LanguageContext.tsx`
  - 中英文切换


## 智能体模式

输入框下方开启「智能体模式」后，请求进入 `/api/agents/run`，由后端 LangGraph 状态图执行 ReAct 循环，模型通过 LangChain 调用。可用工具包括四则运算、当前时间、规划/分析/写作智能体委派，以及 PDF、Excel、PPT 文件生成。模型按任务选择工具，没有联网搜索或任意代码执行能力。

页面实时显示执行说明、工具参数和观察结果，完成后保留展开状态，也可以手动折叠。展示内容是面向用户的决策摘要和工具记录。答案通过 SSE 增量返回，停止按钮可中断执行。

成功的对话轮次通过官方 LangGraph SQLite checkpoint 按 `sessionId` 保存到 `end/local_storage/agent-checkpoints.sqlite`，刷新页面或重启后端仍可继续。同一会话同时只允许一个运行；失败、截断或执行中取消的轮次不进入下一轮成功记忆。不设置应用层 `max_tokens`，仍受供应商模型输出和上下文窗口限制；ReAct 单轮最多 12 次模型调用（不含记忆摘要调用）、HTTP 执行超时 5 分钟。

长对话采用 LangGraph `context` 节点整理记忆：待发送历史与摘要合计超过 24,000 字符时，保留最近 8 条消息原文，将较早历史按 12,000 字符分批合并为最多 6,000 字符的摘要。页面显示摘要覆盖的历史条数。摘要与本轮答案一起成功提交；整理失败、回答失败或取消不会覆盖原有成功记忆。完整成功问答仍保存在 SQLite，摘要用于减少后续模型输入，不会缩小磁盘历史。

新发送的智能体消息保存独立 `turnId`。重新生成成功后替换最后一轮，失败则保留后端原答复；刷新后重试仍使用同一个 ID。升级前未记录轮次 ID 的历史无法自动关联旧答复。

当前记忆不自动同步普通聊天或导入的浏览器历史。浏览器删除会话只删除本地记录，不删除服务端 checkpoint。摘要可能省略细节；阈值按字符估算，近期原文和当前任务仍受模型上下文窗口限制。

## 智能体验证

### 文件生成与下载

在智能体模式中直接输入：

- 「把以上方案整理成中文 PDF，提供下载。」
- 「导出 Excel：项目和金额两列，设计1200、开发3400，金额列需要合计。」

智能体通过 `export_pdf` / `export_excel` / `export_pptx` 实际生成文件，在对话中显示文件名、格式、大小和下载按钮。生成文件的步骤继续实时返回；卡片在文件保存成功后立即出现。文件和下载地址保存在后端，刷新页面后可继续下载，后续问答可以引用已生成的文件地址。

PDF 使用 PDFKit 和随项目提供的 Noto 简体中文字体，支持中文标题、段落、分页和基本标题样式，不依赖 macOS 打印命令。Excel 使用 ExcelJS 生成标准 `.xlsx`，支持多工作表、冻结表头、筛选、数字/文本类型和 SUM 合计公式。当前不支持任意 Excel 公式或复杂 PDF 图表排版。

文件存放在 `end/local_storage/uploads/`，索引在 `file-index.json`，均不进入 Git。部署时保留 `end/assets/fonts/` 并为 `local_storage` 配置持久化目录。已经成功生成的文件，即使后续回答失败或用户停止，仍可通过已有卡片下载；不会自动删除旧版本文件。

### 检查命令

```bash
npm test --prefix end
npx tsc --noEmit
npm run build
```

真实前后端联调（会调用配置的模型 API）使用：

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
python3 scripts/verify_agents.py --url http://127.0.0.1:5175/ai
python3 scripts/verify_step_stream.py --url http://127.0.0.1:5175/ai
python3 scripts/verify_artifacts.py --url http://127.0.0.1:5175/ai
node end/scripts/verifyMemory.js
```

浏览器脚本验证新会话、工具轨迹、SSE、刷新后记忆与重新生成、停止和下一轮恢复，并检查浏览器异常。截图保存在 `/tmp/agent-browser-smoke.png`。`verifyMemory.js` 使用临时 SQLite 数据库和真实模型，验证长历史摘要、早期事实回忆、数据库重开和重试去重，不修改现有会话。

`verify_step_stream.py` 额外观察浏览器 DOM，断言思考说明、行动参数、子智能体观察结果在执行期间多次增长，防止退化为整步完成后才显示。

`verify_artifacts.py` 需要额外安装 `pypdf`、`openpyxl`，会在真实页面生成并下载 PDF 和 Excel，检查中文正文、数值、SUM 公式及缓存结果，再刷新页面验证相同文件仍可下载。

### PDF / PPT 同步预览

例如输入「将以上方案制作成三页 PPT，包含目标、实施步骤和验收计划」。文件保存成功后，`artifact` 事件立即打开右侧预览，不等整轮回答结束。支持翻页、缩放、切换本会话文件、下载原文件、关闭和全屏打开；全屏状态下仍可翻页、缩放和下载，按 Esc 或再次点击按钮退出。手机使用全屏面板。刷新后点击历史消息的「预览」重新查看。

PDF.js 按需加载并渲染真实 PDF。PPT 使用 PptxGenJS 导出可编辑 `.pptx`，同时用相同文本、测量换行和坐标生成含中文字体的配套 PDF 预览。这不是通过 Office 转换的预览，Office 中字体替换可能造成视觉差异。每份演示文稿支持 1–20 页，每页最多 4 条要点，过长内容需拆页，不自动截断。原文件和配套预览均需保留在后端持久化目录。

真实模型与浏览器验证：

```bash
python3 -m pip install playwright pypdf pymupdf
python3 scripts/verify_preview.py --url http://127.0.0.1:5175/ai
```

覆盖 PDF / PPT 生成、自动预览、翻页、原文件下载、刷新重开和手机预览。需要本地前后端已启动、可用模型密钥及 Playwright Chromium。
