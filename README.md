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
```

### 2. 启动开发环境

```bash
npm run dev
```

启动后访问：

- http://localhost:5173/ai

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
VITE_CHAT_BASE_URL=http://your-api-host/api/chat
```

说明：

- 聊天请求会直接发送到 `VITE_CHAT_BASE_URL`
- 模型列表接口会基于该地址自动推导为 `/api/models`
- 文件上传接口会基于该地址自动推导为 `/api/files/upload`

也就是说，如果聊天接口配置为：

```env
VITE_CHAT_BASE_URL=http://your-api-host/api/chat
```

则前端会自动请求：

- `http://your-api-host/api/chat`
- `http://your-api-host/api/models`
- `http://your-api-host/api/files/upload`

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

```text
src/
├── components/        # 通用 UI 组件
├── context/           # Chat / Theme / Language 上下文
├── hooks/             # 截图、复制等 hooks
├── utils/             # 本地消息、导出等工具
├── views/             # 页面级视图
├── assets/            # 图标与静态资源
└── types/             # 类型定义
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

- `src/views/Chat/index.tsx`
  - 聊天主流程
  - 模型能力判断
  - 上传与会话请求拼装
- `src/context/ChatContext.tsx`
  - 会话列表与消息状态管理
- `src/context/ThemeContext.tsx`
  - 主题切换与动画
- `src/context/LanguageContext.tsx`
  - 中英文切换

