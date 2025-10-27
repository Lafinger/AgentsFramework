# AgentsFramework 智能体说明

本文档总结 `AgentsFramework` 项目中的智能体（Agent）能力架构、运行流程与扩展方式，帮助你快速理解并二次开发 LangGraph 驱动的大模型服务。

## 1. 框架概览
- **定位**：基于 FastAPI + LangGraph 的生产级对话智能体骨架，内置鉴权、限流、观测与多环境配置。
- **核心职责**：接入 OpenAI 兼容模型，管理对话状态，支持工具调用（DuckDuckGo 搜索）与 Langfuse 追踪。
- **状态持久化**：通过 PostgreSQL/LangGraph 检查点机制保存对话，确保恢复能力。
- **观测能力**：Prometheus 指标、结构化日志、Langfuse callback handler。

## 2. 核心组件

### 2.1 LangGraphAgent
- 位置：`app/core/langgraph/graph.py`。
- 负责内容：初始化 LLM、构建有状态工作流、串联工具节点、封装聊天/流式接口。
- 图节点：
  - `chat`：准备消息（含系统提示）、重试调用 LLM、记录指标。
  - `tool_call`：按需触发工具并拼装 `ToolMessage`。
- 条件边：`_should_continue` 判断最后一个消息是否包含工具调用，决定是否转入 `tool_call` 节点。
- 检查点：优先启用 `AsyncPostgresSaver`，在数据库异常时根据环境做容错。

### 2.2 提示词体系
- 系统提示：`app/core/prompts/system.md`，通过 `load_system_prompt()` 注入当前项目名和时间。
- 消息预处理：`app/utils/graph.py` 的 `prepare_messages()` 负责拼接系统提示并基于 `max_tokens` 自动裁剪历史。

### 2.3 工具系统
- 注册点：`app/core/langgraph/tools/__init__.py`。
- 默认工具：`duckduckgo_search_tool`（`duckduckgo_search.py`），提供最多 10 条搜索结果，自动处理异常。
- 扩展方式：新建符合 LangChain `BaseTool` 规范的工具后加入 `tools` 列表即可。

### 2.4 数据契约
- `app/schemas/chat.py`：定义 `Message`、`ChatRequest`、`ChatResponse`、`StreamResponse`，内置内容校验与长度限制。
- `app/schemas/graph.py`：`GraphState` 约束会话 ID 格式（UUID 或安全字符）并用于 LangGraph 状态管理。

## 3. 会话生命周期
1. **请求进入**：`app/api/v1/chatbot.py` 通过 FastAPI 接收 `/chat` 或 `/chat/stream` 请求，依赖 `get_current_session()` 获取用户会话。
2. **速率控制**：`limiter.limit(...)` 与 `.env` 中的阈值共同约束请求频率。
3. **消息准备**：`LangGraphAgent.get_response()` 使用 `prepare_messages()` 拼装系统提示及裁剪后的历史消息。
4. **LLM 交互**：在 `chat` 节点调用模型，记录 `llm_inference_duration_seconds` 指标，必要时重试或启用备用模型。
5. **工具调用**：当模型返回 `tool_calls` 时进入 `tool_call` 节点执行异步工具并回写结果。
6. **状态持久化**：若 PostgreSQL 可用，则通过 LangGraph 检查点保存消息以便恢复与 `get_chat_history()` 查询。
7. **结果输出**：同步接口返回 `ChatResponse`；流式接口逐块发送 `StreamResponse`，最后推送 `done=true`。

## 4. 配置要点（`app/core/config.py`）
- **环境感知**：`APP_ENV` 切换 development/staging/production/test，并按环境调整 `DEBUG`、日志格式、速率限制等。
- **LLM 配置**：`LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY`、`MAX_TOKENS`、`MAX_LLM_CALL_RETRIES`。
- **检查点数据库**：`POSTGRES_URL` 及连接池容量（`POSTGRES_POOL_SIZE`、`POSTGRES_MAX_OVERFLOW`）。
- **鉴权与安全**：JWT 设置、允许的跨域来源、消息内容校验（脚本标签、空字节过滤）。
- **观测**：Langfuse 密钥、Prometheus 指标配置、日志目录与输出格式。

## 5. API 交互
- `POST /api/v1/chat`：同步问答，返回完整对话消息数组。
- `POST /api/v1/chat/stream`：SSE 流式输出，逐块推送模型回应。
- `GET /api/v1/messages`：读取当前线程历史。
- `DELETE /api/v1/messages`：清空指定线程历史。

示例请求：

```http
POST /api/v1/chat HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "帮我写一个简短的产品发布公告。"}
  ]
}
```

示例响应（节选）：

```json
{
  "messages": [
    {"role": "user", "content": "帮我写一个简短的产品发布公告。"},
    {"role": "assistant", "content": "…生成的公告…"}
  ]
}
```

## 6. 会话与状态管理
- **会话模型**：`app/models/session.py` 维护用户、令牌与线程 ID 的对应关系。
- **检查点表**：默认使用 `checkpoint_blobs`、`checkpoint_writes`、`checkpoints` 三张表存储 LangGraph 状态（详情见 `settings.CHECKPOINT_TABLES`）。
- **手动清理**：`LangGraphAgent.clear_chat_history()` 遍历检查点表删除指定 `thread_id` 记录。

## 7. 扩展指南
- **自定义提示词**：编辑 `app/core/prompts/system.md` 或在 `load_system_prompt()` 中按环境切换模板。
- **新增工具**：
  1. 在 `app/core/langgraph/tools/` 下创建工具模块，继承 `BaseTool` 或返回兼容对象；
  2. 在 `tools` 列表中注册；
  3. 在 `_tool_call` 中即可自动分发。
- **调整工作流**：在 `LangGraphAgent.create_graph()` 中增删节点或改变条件边，必要时扩展 `GraphState`。
- **模型切换**：修改 `.env.*` 中的 `LLM_MODEL` 与 `DEFAULT_LLM_TEMPERATURE`，或在 `_get_model_kwargs()` 中增加环境特定参数。
- **安全加固**：可在 `Message.validate_content()` 与 `sanitize_string`（`app/utils/sanitization.py`）中补充校验规则。

## 8. 观测、限流与稳定性
- **日志**：`app/core/logging.py` 基于 structlog 输出 JSON 或彩色控制台日志，并按日写入 `logs/<env>-YYYY-MM-DD.jsonl`。
- **指标**：在 FastAPI 应用初始化时调用 `setup_metrics()` 即可暴露 `/metrics`；自定义指标如 `orders_processed_total` 可用于业务跟踪。
- **Langfuse**：`CallbackHandler()` 自动注入请求/会话元数据（用户、环境、session ID）。
- **限流**：`app/core/limiter.py` 集成 `slowapi`；通过 `.env` 的 `RATE_LIMIT_*` 变量覆盖默认配额。
- **错误处理**：捕获 `OpenAIError` 并按环境重试或回退模型，所有异常会结构化记录，便于告警。

## 9. 开发与调试建议
- 安装依赖：`pip install -e .` 或使用 `uv`（参见 `uv.lock`）。
- 本地运行：`uvicorn app.main:app --reload`，确保 `.env.development` 配置了 LLM、数据库与 Langfuse。
- 运行迁移或初始化检查点表时，可参考根目录的 `schema.sql` 与 `init.sql`。
- 建议启用 Prometheus/Grafana（目录 `prometheus/`、`grafana/`）以获得完整观测闭环。

## 10. 目录速览
- `app/api/v1/chatbot.py`：对话 REST 接口与流式推送。
- `app/core/langgraph/graph.py`：智能体主逻辑与工作流编排。
- `app/core/langgraph/tools/`：工具定义与注册。
- `app/core/prompts/`：系统提示模板与加载逻辑。
- `app/schemas/`：Pydantic 模型，定义消息与状态契约。
- `app/utils/`：消息裁剪、鉴权、字符串净化等辅助函数。
- `evals/`：评测与实验脚本（可扩展自动化质检流程）。

通过以上结构，你可以在保持框架稳定性的同时，自由扩展新的智能体能力、集成更多工具或适配不同 LLM 提供商。
