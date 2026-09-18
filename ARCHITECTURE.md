# 项目结构规范

## 总体分层

```text
src/
├── app/                 # 应用装配：路由、全局 Provider、启动配置
├── pages/               # 路由页面（页面组合，不承载底层业务）
├── features/            # 按业务域组织的功能模块
│   ├── chat/            # 对话领域：组件、hooks、请求参数与消息转换
│   └── agents/          # 多智能体领域：Agent 定义、任务、编排器（扩展入口）
├── shared/              # 可跨业务复用的 UI、hooks、工具、类型、资源
└── infrastructure/      # 外部依赖适配：HTTP、SSE、文件、持久化
```

## 依赖方向

- `app` 可以装配所有层。
- `pages` 只组合 `features` 与 `shared`。
- `features` 可以使用 `shared`，通过 `infrastructure` 的接口访问外部服务。
- `shared` 不依赖具体业务域。
- `infrastructure` 不包含页面状态和业务 UI。

## 多智能体扩展约定

`src/features/agents` 是稳定边界。新增能力按以下方式拆分：

- `types.ts`：Agent、Task、Run 等领域类型
- `registry.ts`：可用 Agent 注册与配置
- `orchestrator.ts`：串行、并行、路由等编排策略
- `tools/`：工具声明与执行适配
- `hooks/`：React UI 所需的状态桥接

聊天页面不直接实现编排逻辑，只调用 agents feature 暴露的用例接口。模型请求、SSE 解析和本地存储逐步迁移到 `infrastructure`，便于测试和替换供应商。

实际智能体执行与记忆由后端负责：

- `end/src/models/chatModel.js`：LangChain 模型供应商适配。
- `end/src/agents/graph.js`：LangGraph 节点、ReAct 工具循环、成功记忆提交。
- `end/src/agents/contextMemory.js`：分批整理历史摘要，准备模型上下文。
- `end/src/agents/memoryStore.js`：官方 SQLite checkpoint 与旧历史迁移。
- `end/src/services/agentService.js`：会话校验、单进程并发保护、轮次重试替换。
- `src/features/agents/api.ts`：前端 SSE 协议适配；浏览器不执行模型编排。

`sessionId` 标识会话，`turnId` 标识用户输入轮次。只有 `remember` 节点更新成功历史、摘要与最后轮次 ID；失败执行中的临时上下文不能作为下一轮已提交记忆。

## 命名与导入

- React 组件目录使用 PascalCase，入口统一为 `index.tsx`。
- hooks 使用 `useXxx.ts`，工具使用动词或领域名命名。
- 优先使用 `@/` 别名，禁止跨层级 `../../` 引用。
- 类型只放在 `shared/types` 或所属 feature 的 `types.ts`。
