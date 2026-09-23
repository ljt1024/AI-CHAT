# AI Chat

基于 **React + TypeScript + Express + LangChain / LangGraph** 的全栈 AI 助手，支持多模型对话、ReAct 智能体、持久化会话记忆、文件生成与实时预览、图片理解和文生图。

[在线体验](http://118.31.167.0:3000/ai) · [后端接口与配置](./end/README.md) · [工程结构规范](./ARCHITECTURE.md)

> 在线环境可能与当前分支版本不同，本文以仓库代码为准。

## 功能概览

| 功能 | 当前能力 |
| --- | --- |
| 多模型对话 | DeepSeek、通义千问及自定义 OpenAI 兼容模型；按文本、多模态、文生图、自定义分类 |
| 深度思考 | 流式展示模型返回的思考内容，显示耗时，支持手动折叠，完成后默认保持展开 |
| ReAct 智能体 | LangGraph 编排“思考 → 行动 → 观察 → 再思考”，逐步流式展示工具调用与结果 |
| 多智能体协作 | 主智能体按需委派规划、研究、写作角色 |
| 会话记忆 | LangGraph SQLite checkpoint、成功轮次持久化、历史摘要与近期上下文组合 |
| 工具 | 计算、时间、中国天气，以及 PDF、Excel、PPT、HTML 文件生成 |
| 文件预览 | 左侧执行、右侧预览；生成草稿同步展示，完成后可下载、全屏查看和从历史重新打开 |
| 图片理解 | DeepSeek 原生 Files API，以及其他视觉模型的图片 URL 输入 |
| 文生图 | Qwen-Image-2.0，生成图片后预览与下载 |
| 会话管理 | 浏览器本地历史、重命名、置顶、删除、JSON 导入导出、重新生成 |
| 交互与国际化 | 中英文、明暗主题、Markdown、代码复制、截图分享、移动端适配 |

## 快速开始

### 1. 环境与依赖

需要 **Node.js >= 22.13.0** 和 npm；后端的 SQLite checkpoint 依赖此运行环境。在项目根目录执行：

```bash
npm ci
npm ci --prefix end
```

### 2. 配置环境变量

在根目录创建 `.env.development`：

```env
VITE_CHAT_BASE_URL=http://localhost:3001/api/chat/completions
```

在 `end/.env` 配置后端，至少填写一个实际使用的模型供应商密钥：

```env
PORT=3001
DEEPSEEK_API_KEY=替换为你的DeepSeek密钥
# 使用通义千问或文生图时填写
# DASHSCOPE_API_KEY=替换为你的阿里云百炼密钥
# 使用天气工具时填写高德Web服务类型的Key
# AMAP_API_KEY=替换为你的高德密钥
# 开启自定义模型管理时设置，并在配置界面输入相同令牌
# MODEL_CONFIG_TOKEN=替换为你生成的管理令牌
```

未配置密钥的内置供应商模型会显示为未启用。已配置密钥不代表账号一定具有对应模型的调用权限。

密钥只放在后端环境中，不能写入 `VITE_*` 变量；这些前端变量会进入浏览器构建产物。环境文件已由 `.gitignore` 排除，请自行创建。

### 3. 启动前后端

终端一，启动后端（默认端口 `3001`，支持代码变更自动重启）：

```bash
npm run dev --prefix end
```

终端二，启动前端（默认端口 `5174`）：

```bash
npm run dev
```

访问 **http://localhost:5174/ai**。前端端口被占用时可以指定新端口：

```bash
npm run dev -- --host 127.0.0.1 --port 5175
```

前端直接请求 `VITE_CHAT_BASE_URL`，当前 Vite 配置没有 API 代理。模型、上传、智能体等接口会基于该地址推导，因此应填写本项目后端的完整聊天接口地址，而非供应商 API 地址。

## 模型与使用方式

### 内置模型

| 模型 ID | 用途与区别 |
| --- | --- |
| `deepseek-flash` | 流式对话、深度思考、图片理解、原生 Files API、智能体工具调用 |
| `deepseek-chat` / `deepseek-reasoner` | 保留的对话模型 ID；项目中未标记为支持图片理解 |
| `qwen-turbo` | 文本对话、深度思考、工具调用 |
| `qwen3.5-plus` | 对话、深度思考、图片理解、工具调用 |
| `qwen-max` | 文本对话与工具调用；项目中未启用深度思考 |
| `qwen-image-2.0` | 专用文生图模型，不作为普通聊天或 ReAct 主模型 |

能力标签来自后端模型配置，实际可用性以供应商接口和账号权限为准。“多模态”分类目前指图片理解，不代表音频、视频能力。

### 自定义模型

在 **切换模型 → 模型配置** 中新增、编辑或删除自定义模型，填写展示名称、上游模型 ID、Base URL 和 API Key，并按实际能力设置图片理解、工具调用选项。

- 当前适配 OpenAI 兼容的 **流式 Chat Completions** 接口，不包含自定义文生图协议。
- 未启用工具调用能力的模型不能进入智能体模式。
- 后端必须设置 `MODEL_CONFIG_TOKEN`；管理请求通过 `x-model-config-token` 校验。未设置时管理接口关闭。
- 配置是服务端共享配置，保存在 `end/local_storage/custom-models.json`，不是每个用户独立的模型列表。
- 模型列表不会返回 API Key；编辑时留空密钥表示保留原值。配置文件中包含密钥，需要随服务端数据妥善保管。

### 深度思考

选择支持深度思考的模型并打开开关后，发送消息即显示“思考中…”，收到 `reasoning_content` 后实时展示。思考结束后显示耗时，默认保持展开，可点击标题手动折叠；历史消息也默认展开。

耗时按前端收到首个思考片段到首个回答片段的时间计算，不代表供应商内部精确计算时间。旧消息若没有计时数据，不会补造耗时。

### 图片理解

选择支持图片理解的模型后上传图片，等待上传完成再发送问题。

- **DeepSeek Flash**：通过 DeepSeek 原生 Files API 上传，消息使用 `file_id`，无需配置 OSS。支持 JPEG、PNG、GIF、WebP，普通聊天和智能体模式均可使用。
- **其他支持图片 URL 的视觉模型**：使用 OSS 上传链路，需要配置下文的 OSS 参数。
- 应用默认单文件上限为 **20 MiB**。DeepSeek 原生上传当前只接受图片，不能据此上传 PDF、Word 等文档。
- 移除输入框附件不会删除 DeepSeek 端已上传的文件。

### 文生图

先选择 **Qwen-Image-2.0**，再输入画面描述。需要配置 `DASHSCOPE_API_KEY`，且密钥地域、接口和模型权限一致。

文生图使用独立 LangGraph 流程调用 LangChain 图片工具，流式返回执行状态，图片生成完毕后展示 PNG，支持预览、全屏和下载。当前为单轮生成，不支持连续图片编辑或像素级流式输出，普通聊天模型不会自动获得文生图能力。

## 智能体模式

在输入区开启智能体模式，使用支持工具调用的模型。主智能体通过 LangChain 消息与工具接口执行任务，由 LangGraph 管理循环和记忆。

```text
用户输入 → 读取会话记忆 → 思考 / 选择工具 → 执行工具 → 观察结果
                              ↑                         │
                              └─────────────────────────┘
                         → 输出最终回答 → 提交成功轮次记忆
```

执行期间通过 SSE 展示步骤、工具参数、观察结果和回答。页面可显示“正在调用天气工具”“已生成并写入文件”等实际执行事件，并支持展开原始参数与结果。执行轨迹来自真实事件；模型思考文本仅在上游返回时展示。

### 可用工具

| 工具 | 用途 |
| --- | --- |
| `calculate` / `current_time` | 计算与当前时间 |
| `get_weather` | 高德地理编码与天气查询，支持中国城市实时天气、预报 |
| `delegate_planner` / `delegate_researcher` / `delegate_writer` | 委派规划、研究和写作角色 |
| `export_pdf` / `export_excel` / `export_pptx` / `export_html` | 生成文件并返回下载、预览信息 |

例如：“查询杭州天气并给出出行建议”“把这份计划整理成 PDF”“生成一份包含合计的 Excel 预算表”“制作项目介绍 PPT，并同步预览”。

天气工具需要高德 **Web 服务类型 Key**，免费额度及使用范围以高德平台规则为准。研究角色当前不等于联网搜索；项目尚未提供通用网页搜索或任意代码执行工具。

### 记忆与执行边界

- 使用 `sessionId` 区分会话、`turnId` 标识轮次，SQLite checkpoint 保存在 `end/local_storage/agent-checkpoints.sqlite`。
- 仅成功完成的轮次提交为后续对话记忆；失败、取消或截断不会覆盖已成功的历史。最近一轮重试支持替换该轮记忆。
- 长上下文通过摘要与近期消息组合控制体积；摘要有损且按字符估算，完整成功历史仍保留在存储中。
- 浏览器聊天记录与服务端智能体记忆是两份数据，普通聊天历史不会自动完整同步为智能体记忆。
- 删除浏览器会话不等于删除服务端 checkpoint 或生成文件。
- 当前默认最多 12 次推理迭代，智能体请求总超时 5 分钟；不再设置应用层统一 `2048 token` 输出上限，但仍受供应商限制。

### 文件生成与同步预览

| 格式 | 实现与预览方式 |
| --- | --- |
| PDF | PDFKit 生成，内置中文字体，支持分页与缩放 |
| Excel | ExcelJS 生成 `.xlsx`，提供表格预览，支持数值与 SUM 等受控能力 |
| PPT | PptxGenJS 生成 `.pptx`，另行生成 PDF 用于预览；并非 Office 原文件的精确转换 |
| HTML | 支持生成过程中的草稿预览，最终页面在受限沙箱中展示 |

左侧继续执行时，右侧根据已收到的内容更新草稿；保存后切换为最终文件预览。预览共享页面顶栏，支持全屏和下载原文件。HTML 预览限制脚本与远程资源，不等同于完整浏览器运行环境；Excel 不支持任意公式执行。

## 环境配置参考

以下变量放在 `end/.env`，按需配置：

| 变量 | 默认值 / 说明 |
| --- | --- |
| `PORT` | `3001` |
| `DEEPSEEK_API_KEY` | DeepSeek 对话、图片理解和原生文件上传 |
| `DASHSCOPE_API_KEY` | 通义千问与文生图，也可使用 `QWEN_API_KEY` |
| `AMAP_API_KEY` | 高德天气工具，也可使用 `GAODE_API_KEY` |
| `MODEL_CONFIG_TOKEN` | 自定义模型管理令牌，未配置则禁用管理接口 |
| `QWEN_IMAGE_ENDPOINT` | 默认阿里云 DashScope 多模态生成接口 |
| `MAX_UPLOAD_FILE_SIZE_BYTES` | `20971520`，即 20 MiB |
| `MAX_FILE_UPLOAD_COUNT` | `10`，后端上传数量上限；当前界面单次选择一个文件 |
| `MAX_FILE_CONTENT_LENGTH` | `12000`，文件文本内容长度上限 |
| `OSS_SIGNED_URL_EXPIRES_SECONDS` | `1800`，OSS 签名 URL 有效秒数 |

图片 URL 上传链路需要：

```env
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=你的Bucket名称
OSS_ACCESS_KEY_ID=你的AccessKeyId
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
# 可选：OSS_STS_TOKEN、OSS_ENDPOINT、OSS_SECURE、OSS_PREFIX
```

OSS 参数也支持 `ALI_OSS_*` 别名。仅使用文本对话、DeepSeek 原生图片上传或文件生成时，无需配置 OSS。

## 项目结构

```text
AI-CHAT/
├── src/
│   ├── app/                   # 应用装配、路由、国际化
│   ├── pages/                 # 页面组合
│   ├── features/              # chat、agents 等业务模块
│   ├── shared/                # 共享组件、hooks、类型与资源
│   └── infrastructure/        # 外部服务适配边界
├── end/
│   ├── app.js                 # 后端入口
│   ├── src/
│   │   ├── agents/            # LangGraph、工具、记忆与角色注册
│   │   ├── models/            # LangChain 模型适配
│   │   ├── services/          # 对话、上传、天气、文件生成等服务
│   │   ├── routes/            # HTTP 与 SSE 接口
│   │   ├── config/            # 环境变量、内置与自定义模型
│   │   └── i18n/              # 后端中英文文案
│   ├── assets/fonts/          # PDF 中文字体
│   ├── local_storage/         # 运行数据，不纳入 Git
│   └── scripts/               # 后端验证脚本
├── scripts/                   # 国际化检查与浏览器验证脚本
├── ARCHITECTURE.md            # 分层与依赖规范
└── README.md
```

前端中英文资源位于 `src/app/i18n/locales/`，后端资源位于 `end/src/i18n/locales/`。语言默认跟随浏览器，支持用户切换与持久化；用户输入和模型生成内容不会自动翻译。

## 开发与验证

在项目根目录执行：

```bash
npx tsc --noEmit             # TypeScript 检查
npm run check:i18n          # 国际化资源检查
npm test --prefix end      # 后端测试
npm run build              # 前端生产构建，输出 dist/
npm run preview            # 本地预览构建产物，仍需单独运行后端
```

浏览器验证脚本需要 Python 和 Playwright。建议在虚拟环境中安装：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install playwright
python -m playwright install chromium
python scripts/verify_i18n.py --url http://localhost:5174/ai
```

智能体、流式步骤、文件预览、文生图及 DeepSeek 图片理解分别提供 `verify_agents.py`、`verify_step_stream.py`、`verify_preview.py`、`verify_image.py`、`verify_deepseek_vision.py` 等脚本。执行前阅读对应脚本的依赖与模型要求，部分文件验证还需安装 PDF / Excel 解析库。

这些端到端脚本可能调用真实模型并产生费用；`verify_i18n.py` 默认不发送真实模型请求，添加 `--live` 才执行在线对话验证。后端真实记忆验证入口为 `node end/scripts/verifyMemory.js`。

## 部署与数据保留

1. 在根目录创建 `.env.production`，将 `VITE_CHAT_BASE_URL` 设置为用户浏览器可访问的生产聊天接口完整地址，再执行 `npm run build`。前端变量在构建时固化，不能只修改服务器环境而不重新构建。
2. 将 `dist/` 部署到静态服务器，为 `/ai` 等前端路由配置回退到 `index.html`。
3. 部署 `end/`，保留字体资源和依赖锁文件；服务器安装 Node.js 22.13+，执行 `npm ci --omit=dev --prefix end`，配置 `end/.env` 后运行 `npm start --prefix end`。
4. 使用 PM2 等进程管理器时设置正确的后端工作目录与 Node 解释器。当前并发保护位于单进程内，SQLite 部署建议使用单实例。
5. 反向代理 SSE 接口时关闭响应缓冲，将读取超时设为大于 300 秒；HTTPS 页面也应使用 HTTPS API 地址。

升级时保留 `end/.env` 和整个 `end/local_storage/`。其中包含会话 checkpoint、生成文件与上传文件、文件索引、自定义模型配置；删除会导致记忆或历史文件不可用。SQLite 备份应使用一致性快照或停服务备份，避免只复制运行中的主数据库而遗漏 WAL 数据。

当前没有完整的用户登录、多租户数据隔离体系。对外提供服务时，应在部署层配置访问控制；模型管理令牌只保护模型配置操作。

## 常见问题

- **接口 404**：检查 `VITE_CHAT_BASE_URL` 是否指向本项目后端的 `/api/chat/completions`，以及代理是否保留 `/api` 路径。不要填前端端口或供应商地址。
- **请求 400 / 模型不可用**：查看接口返回的具体错误与后端日志，核对模型 ID、供应商权限、工具调用能力和附件格式，不能仅凭已配置 Key 判断模型可用。
- **一次性返回，没有流式效果**：检查上游是否支持流式，以及代理、CDN 是否缓冲 SSE。文生图只流式返回状态，最终图片一次性返回。
- **模型配置无法保存**：检查后端是否设置 `MODEL_CONFIG_TOKEN`，界面填写的令牌是否一致，以及数据目录是否可写。
- **重启后记忆或文件丢失**：确认服务始终使用同一份 `end/local_storage/`，并检查部署是否覆盖了运行数据。
- **更换 API 地址后没有生效**：开发环境需重启 Vite，生产环境需重新构建并部署前端。

## 相关文档

- [后端接口与详细配置](./end/README.md)
- [项目分层与扩展规范](./ARCHITECTURE.md)
- [DeepSeek Files API](https://api-docs.deepseek.com/zh-cn/api/create-file)
- [DeepSeek 图片理解](https://api-docs.deepseek.com/zh-cn/guides/vision)
- [LangChain 文档](https://docs.langchain.com/oss/javascript/langchain/overview)
- [LangGraph 文档](https://docs.langchain.com/oss/javascript/langgraph/overview)
