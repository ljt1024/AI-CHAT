# AI-Server

一个面向客户端的轻量级 AI 对话代理服务，统一封装 DeepSeek 和 Qwen 的聊天接口，并补齐模型列表、文件上传、分享接口、请求日志等服务端能力。

适合这样的场景：

- 客户端希望只对接一套 `/api` 接口，而不是分别适配多家模型供应商
- 需要在服务端集中管理 API Key、模型能力、文件上传和错误日志
- 需要兼容不同厂商的“深度思考”参数差异

## Features

- 统一的 OpenAI 风格聊天入口：`/api/chat/completions`
- 同时支持 DeepSeek 和 Qwen
- 自动兼容思考参数：
  - Qwen 使用 `enable_thinking`
  - DeepSeek 使用 `thinking`
  - 客户端可统一传 `thinking`
- 支持流式输出
- 支持文件上传和 `fileId` 引用
- 支持图片消息注入和文本文件内容注入
- 支持生成 PDF / Word 文档，并返回可下载地址
- 提供模型列表接口
- 提供简单的聊天分享接口
- 内置请求级 `requestId` 和结构化日志，便于排查上游 4xx/5xx

## Supported Models

当前内置模型如下：

| Model | Provider | Stream | Thinking | File Upload | Vision |
| --- | --- | --- | --- | --- | --- |
| `deepseek-chat` | DeepSeek | Yes | Yes | No | No |
| `deepseek-reasoner` | DeepSeek | Yes | Yes | No | No |
| `qwen-turbo` | Qwen | Yes | Yes | No | No |
| `qwen3.5-plus` | Qwen | Yes | Yes | Yes | Yes |
| `qwen-max` | Qwen | Yes | No | No | No |

说明：

- `/api/chat/completions` 可按 `model` 动态选择模型
- `/api/deepseek/chat` 会固定走 `deepseek-reasoner`
- 文件上传能力目前只对支持文件的模型生效，当前为 `qwen3.5-plus`

## API Overview

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/models` | 获取可用模型列表 |
| `GET` | `/api/agents` | 获取可委派的智能体列表 |
| `POST` | `/api/agents/run` | LangGraph ReAct 执行，支持 SSE 和会话记忆 |
| `POST` | `/api/chat/completions` | 统一聊天接口 |
| `POST` | `/api/deepseek/chat` | 固定使用 `deepseek-reasoner` 的快捷接口 |
| `POST` | `/api/files/upload` | 上传文件并返回 `fileId` 与可访问地址 |
| `POST` | `/api/files/document` | 根据标题/正文直接生成 PDF 或 Word 文档 |
| `GET` | `/api/files/:fileId/download` | 下载本地生成或本地存储的文件 |
| `POST` | `/api/chat/shareCreate` | 创建分享内容 |
| `POST` | `/api/chat/shareMsg` | 根据 `id` 读取分享内容 |

## Project Structure

```text
.
├── app.js
├── src
│   ├── app.js
│   ├── server.js
│   ├── config
│   │   ├── env.js
│   │   └── models.js
│   ├── routes
│   │   ├── chatRoutes.js
│   │   ├── fileRoutes.js
│   │   ├── modelRoutes.js
│   │   └── shareRoutes.js
│   ├── services
│   │   ├── chatService.js
│   │   ├── fileService.js
│   │   └── shareService.js
│   └── utils
│       ├── http.js
│       ├── logger.js
│       └── upload.js
└── local_storage
```

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure

在项目根目录创建 `.env`：

```env
PORT=3001

DEEPSEEK_API_KEY=your_deepseek_api_key
DASHSCOPE_API_KEY=your_qwen_api_key

MAX_UPLOAD_FILE_SIZE_BYTES=20971520
MAX_FILE_UPLOAD_COUNT=10
MAX_FILE_CONTENT_LENGTH=12000
OSS_SIGNED_URL_EXPIRES_SECONDS=1800

OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your_bucket
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_ENDPOINT=
OSS_SECURE=true
OSS_PREFIX=uploads
```

说明：

- 只用 DeepSeek 时，可只配置 `DEEPSEEK_API_KEY`
- 只用 Qwen 时，可只配置 `DASHSCOPE_API_KEY` 或 `QWEN_API_KEY`
- 如果不使用上传接口，可以先不配置 OSS
- 使用 `/api/files/upload` 时，OSS 为必填

### 3. Run

```bash
npm run start
```

默认启动地址：

```text
http://localhost:3001
```

## Usage

### 获取模型列表

```bash
curl http://localhost:3001/api/models
```

### 发起普通对话

```bash
curl -X POST http://localhost:3001/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "stream": false,
    "messages": [
      { "role": "user", "content": "介绍一下你自己" }
    ]
  }'
```

### 开启深度思考

客户端统一传 `thinking` 即可，服务端会根据 provider 自动转换。

```bash
curl -X POST http://localhost:3001/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-reasoner",
    "stream": false,
    "thinking": true,
    "messages": [
      { "role": "user", "content": "请分步骤分析这个问题" }
    ]
  }'
```

兼容规则：

- 当模型为 Qwen 时，服务端会转为 `enable_thinking`
- 当模型为 DeepSeek 时，服务端会转为 `thinking: { "type": "enabled" }`
- 旧客户端如果仍传 `enable_thinking`，Qwen 侧仍可兼容

### 上传文件

支持 `application/json`、`multipart/form-data` 和原始二进制上传。

JSON 示例：

```bash
curl -X POST http://localhost:3001/api/files/upload \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "notes.txt",
    "mimeType": "text/plain",
    "content": "这是一段测试内容"
  }'
```

返回结果中会包含：

- `fileId`
- `url`
- `urlExpiresAt`
- `createdAt`

### 在对话中引用已上传文件

```bash
curl -X POST http://localhost:3001/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-plus",
    "stream": false,
    "messages": [
      { "role": "user", "content": "总结文件内容" }
    ],
    "fileIds": ["your-file-id"]
  }'
```

文件处理规则：

- 图片文件：会作为图片消息注入模型上下文
- 文本文件：会读取正文并注入系统提示词
- 二进制非文本文件：仅传递元信息，不提取正文

### 直接生成 PDF / Word 文档

支持 `format: "pdf"`、`"docx"` 或 `"word"`。

```bash
curl -X POST http://localhost:3001/api/files/document \
  -H "Content-Type: application/json" \
  -d '{
    "format": "pdf",
    "fileName": "weekly-report",
    "title": "本周周报",
    "content": "1. 完成接口联调\n\n2. 修复上传链路\n\n3. 下周计划：补齐文档导出"
  }'
```

返回结果中会包含：

- `fileId`
- `url`
- `downloadPath`
- `fileName`
- `mimeType`

### 在聊天接口中直接生成文档

当客户端希望“让模型先写内容，再自动落成文件”时，可以在非流式聊天请求中附带 `document` 参数。

```bash
curl -X POST http://localhost:3001/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "stream": false,
    "messages": [
      { "role": "user", "content": "请帮我写一份项目周报，分为进展、风险、下周计划三部分" }
    ],
    "document": {
      "format": "word",
      "fileName": "project-weekly-report",
      "title": "项目周报"
    }
  }'
```

服务端会在聊天响应顶层额外挂出 `generatedDocument` 字段，里面包含下载地址和文件元信息。

注意：

- `document` 仅支持 `stream: false`
- Word 文档生成依赖 macOS 自带的 `textutil`
- PDF 文档生成使用 PDFKit 与 `assets/fonts/NotoSansCJKsc-Regular.otf` 内嵌中文字体，支持跨平台部署。字体采用 SIL OFL 1.1 许可证，部署时保留字体文件与许可证。

## Logging

服务启动后会输出 JSON 结构化日志，主要包括：

- `request.start`
- `request.finish`
- `chat.proxy.request`
- `chat.proxy.success`
- `chat.proxy.error`

每个请求都会带上 `X-Request-Id`，方便按请求链路排查问题。

日志中默认记录：

- 请求路径
- 模型名
- provider
- 状态码
- 耗时
- 上游返回的裁剪版错误信息

默认不会记录：

- API Key
- 完整消息正文

## Error Handling

常见错误包括：

- `400`: 请求参数错误、模型不支持、`thinking` 参数格式不合法
- `500`: 服务端配置缺失，例如 API Key 未配置
- `502`: 上游模型接口或 OSS 调用失败

如果对接异常，优先检查：

1. 返回头中的 `X-Request-Id`
2. 服务端 `chat.proxy.error` 日志
3. `.env` 中的模型和 OSS 配置

## Share API Notes

`/api/chat/shareCreate` 和 `/api/chat/shareMsg` 当前为轻量实现：

- 数据保存在内存中
- 服务重启后不会保留
- 更适合作为本地开发或简单演示能力

如果要用于生产环境，建议替换为数据库或持久化存储。

## Tech Stack

- Node.js
- Express
- Axios
- Aliyun OSS SDK
- dotenv

## License

当前仓库未声明 License。如需开源发布，建议补充 `LICENSE` 文件。

## LangGraph 智能体接口

Node.js 22.13+；开发时使用 `npm run dev` 自动重载，生产启动使用 `npm start`。

```bash
curl -N http://localhost:3001/api/agents/run \
  -H 'Content-Type: application/json' \
  -d '{"input":"请计算6*7","sessionId":"example-session-1","model":"deepseek-chat","stream":true}'
```

`input` 为非空文本，`sessionId` 是当前会话唯一 ID（1–128 位字母、数字、下划线或连字符，禁止 `default`）。`model` 默认 `deepseek-chat`。可传 `agentIds` 数组限定允许委派的角色：`planner`、`researcher`、`writer`，空数组保留计算器、时间和文件导出工具。

可选 `turnId` 使用同样的 1–128 位 ID 格式。新一轮使用新 ID，重新生成沿用原 ID 与原输入：成功后替换最后一轮，失败时保留已提交问答。重复使用更早轮次 ID 或修改同 ID 的输入返回 409。不传 ID 时服务端生成新 ID，按新一轮处理；这不是缓存接口，同 ID 重新生成仍会调用模型。

设置 `stream: true` 返回 `text/event-stream`，每个事件为 `data: {JSON}\n\n`；15 秒发送一次心跳注释。

| type | 数据 | 客户端行为 |
| --- | --- | --- |
| `start` | `sessionId`, `memoryMessages` | 展示已读取的成功历史条数 |
| `memory` | `summarizedMessages`, `recentMessages` | 展示摘要覆盖条数与近期原文条数 |
| `step` | `step: {id, phase, status, output, agentId?, toolCallId?}` | 按 ID 新增或更新思考/行动/观察 |
| `step_delta` | `stepId`, `text`, `reset?` | 为指定步骤追加增量文本；`reset: true` 时先清空占位说明 |
| `artifact` | `artifact: {fileId, fileName, format, mimeType, size, downloadPath, createdAt, previewFileId?, pageCount?}` | 文件已保存，立即展示下载卡片与 PDF/PPT 预览 |
| `answer_start` | 无 | 新的模型轮次开始，清空上一轮临时正文 |
| `delta` | `text` | 追加增量正文 |
| `done` | `result: {id, sessionId, input, output, steps, memoryMessages, artifacts}` | 最终结果、文件列表及写入后的记忆条数 |
| `error` | `message`, `requestId` | 标记失败，保留可读原因 |

请求校验失败在 SSE 开始前返回 JSON 4xx；SSE 开始后的错误通过 `error` 事件返回。客户端必须收到 `done` 才能视为成功，连接提前结束应视为未完成。不传 `stream` 时返回 `{code: 200, data: result, msg: "ok"}`。

步骤也采用增量输出：主模型公开执行说明写入 `thought`，工具参数生成写入 `action`（`stage: preparing`），工具开始执行后为 `stage: executing`，子智能体通过 LangChain `stream()` 将文本逐段写入 `observation`。即时计算和时间工具完成后立即返回结果。每个步骤先发送 `step` 创建记录，中间发送 `step_delta`，最后发送完整 `step` 更新状态。同一 ID 只更新、不新增重复步骤，`done.result.steps` 为最终完整记录。展示的是公开输出和工具记录，不转发模型内部推理字段。

后端使用 LangChain `ChatOpenAI` 和工具定义，通过 LangGraph `context → reason → tools → reason → remember` 执行；工具参数由 Zod 校验。`context` 节点准备历史摘要和近期原文，`remember` 节点提交本轮成功记忆。页面收到的是执行摘要和工具记录。委派工具调用同一模型的不同角色，按模型选择依次执行，不具备联网或操作系统执行能力。

官方 `SqliteSaver` 将 checkpoint 保存到 `local_storage/agent-checkpoints.sqlite`，以 `thread_id=sessionId` 隔离会话，服务重启后自动恢复。下一轮仅采用成功问答历史，失败轮次的中间 checkpoint 不作为成功记忆注入。首次可迁移旧 `agent-memory.json` 中对应会话，跳过共享 `default` 桶。

同会话并发保护目前在单进程内实现（409）；取消通过断开 HTTP 连接传播 AbortSignal。应用不设置 `max_tokens`，上游返回 `finish_reason=length` 会明确报错。ReAct 模型循环上限为 12 次（不含摘要调用），HTTP 总超时 5 分钟。

长历史超过 24,000 字符后归纳较早消息，保留最近 8 条原文。整理器通过未绑定工具的 LangChain 模型分批处理，每批最多 12,000 字符，输出摘要最多 6,000 字符；超长单条历史也会分批处理。摘要为空、被截断或超长会明确报错。`summary`、`summarizedMessages` 和 `history` 在最终成功节点一起提交，中间摘要失败或本轮回答失败不会替换已提交记忆。

这些默认参数位于 `src/agents/contextMemory.js`；完整成功历史仍保存在 checkpoint 中，压缩的是模型输入，并非数据库。摘要是有损整理，字符阈值不是精确 token 预算；保留的近期原文、当前输入及工具结果仍需满足模型上下文窗口限制。

测试命令 `npm test` 覆盖计算工具、增量事件、SQLite 重开恢复、会话隔离、失败/取消记忆、并发冲突、摘要分批与失败保留、重试替换、请求校验及 HTTP 流式与中断行为。真实浏览器验证见项目根目录 `scripts/verify_agents.py`；运行 `node scripts/verifyMemory.js` 可使用真实模型和临时数据库验证长历史摘要及重试恢复。

### PPT 与配套预览

LangChain 工具 `export_pptx` 使用 PptxGenJS 生成可编辑 PowerPoint，并通过 PDFKit 生成使用相同文本和布局的中文 PDF 预览。`artifact.format` 为 `pptx`，`previewFileId` 指向预览 PDF，`pageCount` 为页数。两者均通过 `GET /api/files/:fileId/download` 获取，前端 PDF.js 直接读取二进制，不依赖浏览器内置 PDF 插件。PDF 文件直接使用自身 `fileId` 预览。预览面板支持原生 Fullscreen API；浏览器拒绝该 API 时使用 CSS 全屏回退，按 Esc 或按钮退出。

参数为 `{title, slides: [{title, body: string[]}]}`，允许 1–20 页，每页标题最多 40 字，正文 1–4 条、每条最多 100 字；排版空间不足时工具报告错误供智能体拆页重试，不丢弃正文。PPT 预览是共用布局生成的配套 PDF，未接入 LibreOffice/Office 原文件转换，字体在 Office 中可能被替换。
