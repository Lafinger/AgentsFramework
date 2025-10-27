# AgentsFramework

> 基于 FastAPI 与 LangGraph 的生产级对话智能体骨架，内置鉴权、限流、观测与 Langfuse 追踪。

## 项目概览
AgentsFramework 针对需要构建 OpenAI 兼容聊天服务的场景，结合 FastAPI 与 LangGraph 提供状态化会话管理、DuckDuckGo 搜索工具节点、PostgreSQL 持久化以及 Langfuse、Prometheus、structlog 的全链路观测能力。

## 核心特性
- **LangGraph 工作流** —— 在 `app/core/langgraph/graph.py` 中定义 `chat` 与 `tool_call` 节点，自动裁剪历史消息并处理模型重试。
- **安全 API** —— `app/api/v1/auth.py` 与 `app/utils/sanitization.py` 提供 JWT 鉴权、会话管理、输入净化和强密码校验。
- **工具与 RAG** —— 内置 DuckDuckGo 搜索工具及 `/api/v1/rag` 的轻量级检索服务，可快速扩展新工具。
- **观测与运维** —— Prometheus 指标、Langfuse 回调与 structlog JSON/控制台日志默认启用。
- **生产级防护** —— 分环境配置、SlowAPI 限流、Postgres 检查点与错误兜底策略。
- **开发体验** —— Docker 配置、`web/` 可视化测试界面、完备的 lint/测试工具链。

## 系统架构速览
- `app/main.py` 负责启动 FastAPI、限流器、指标中间件与健康检查。
- `app/api/v1/` 聚合鉴权、聊天、RAG 等子路由。
- `app/services/` 提供 SQLModel + PostgreSQL 数据持久化与检索服务封装。
- `app/core/` 管理配置、日志、指标、提示词与 LangGraph 工具注册。
- `app/schemas/` 定义请求/响应及 GraphState 数据契约。

## 目录结构
```text
app/
├─ api/                     # FastAPI 路由
├─ core/                    # 配置、日志、提示词、LangGraph 工作流
├─ models/                  # SQLModel 实体
├─ schemas/                 # Pydantic 请求/响应模型
├─ services/                # 数据库与 RAG 服务
├─ utils/                   # 消息裁剪、鉴权、净化工具
evals/                      # 评测脚本与实验
grafana/, prometheus/       # 观测栈配置
scripts/                    # Docker 辅助脚本
web/                        # 浏览器测试客户端
```

## 快速开始
1. **创建虚拟环境**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
2. **安装依赖**
   ```powershell
   pip install -e .
   ```
3. **准备环境变量**
   ```powershell
   Copy-Item .env.example .env.development
   ```
   根据实际情况填写 `LLM_API_KEY`、`POSTGRES_URL`、`JWT_SECRET_KEY` 等参数。
4. **启动开发服务**
   ```powershell
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
5. 打开 `http://localhost:8000/docs` 查看 Swagger UI，或直接加载 `web/index.html` 进行全流程自测。

## 配置说明
常用环境变量（完整示例见 `.env.example`）：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `APP_ENV` | 运行环境：`development` / `staging` / `production` / `test` | `development` |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` | 上游模型调用配置 | OpenAI 默认值 |
| `MAX_TOKENS` / `MAX_LLM_CALL_RETRIES` | LangGraph 调用限制 | `2000` / `3` |
| `POSTGRES_URL` | SQLModel 与 LangGraph 检查点使用的数据库连接 | _空_ |
| `JWT_SECRET_KEY` | 签发 JWT 会话令牌的密钥 | _强制设置_ |
| `RATE_LIMIT_*` | SlowAPI 的限流规则 | 详见 `app/core/config.py` |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Langfuse 观测凭据 | _可选_ |
| `LOG_FORMAT` / `LOG_LEVEL` | 日志输出格式与级别 | `json` / `INFO` |

## Docker 部署
- 使用 `docker-compose.yml` 同时启动 API、Prometheus、Grafana 与 cAdvisor：
  ```powershell
  docker compose up --build
  ```
- 如需数据库，可先启动 `docker-compose-external.yml` 获取 PostgreSQL 与 pgAdmin：
  ```powershell
  docker compose -f docker-compose-external.yml up -d
  ```
生产环境建议挂载对应的 `.env.<env>` 文件，并通过环境变量覆盖敏感信息。

## 运维与观测
- `/metrics` 暴露 `http_requests_total`、`llm_inference_duration_seconds` 等 Prometheus 指标。
- 日志按日写入 `logs/<env>-YYYY-MM-DD.jsonl`，开发模式可切换彩色控制台输出。
- Langfuse `CallbackHandler` 默认注入用户/会话元数据，便于全链路追踪。
- SlowAPI 对关键端点提供 429 保护，错误信息采用结构化返回。

## API 速查
| 方法 | 路径 | 描述 | 鉴权 |
| --- | --- | --- | --- |
| `GET` | `/` | 获取应用元信息与当前环境 | 否 |
| `GET` | `/health` | API 与数据库健康检查 | 否 |
| `GET` | `/api/v1/health` | v1 健康检查 | 否 |
| `POST` | `/api/v1/auth/register` | 用户注册 | 否 |
| `POST` | `/api/v1/auth/login` | 用户登录并获取 JWT | 否 |
| `POST` | `/api/v1/auth/session` | 创建聊天会话并返回令牌 | 是 |
| `PATCH` | `/api/v1/auth/session/{id}/name` | 更新会话名称 | 是 |
| `DELETE` | `/api/v1/auth/session/{id}` | 删除会话 | 是 |
| `GET` | `/api/v1/auth/sessions` | 获取会话列表及新令牌 | 是 |
| `POST` | `/api/v1/chatbot/chat` | 请求 LangGraph 聊天响应 | 是 |
| `POST` | `/api/v1/chatbot/chat/stream` | SSE 流式响应 | 是 |
| `GET` | `/api/v1/chatbot/messages` | 获取持久化消息历史 | 是 |
| `DELETE` | `/api/v1/chatbot/messages` | 清除消息历史 | 是 |
| `GET` | `/api/v1/rag/documents` | 查看知识库文档列表 | 否 |
| `POST` | `/api/v1/rag/query` | 检索并汇总相关文档 | 否 |

需要鉴权的接口请携带 `Authorization: Bearer <token>` 头部。

## RAG 能力
`app/services/rag.py` 读取 JSON 知识库并通过 Jaccard 相似度打分，`/api/v1/rag/query` 将返回回答摘要与命中的文档来源，可作为 LangGraph 工作流的检索增强模块。

## 前端测试界面
`web/` 目录提供纯 HTML/JS 的测试面板，覆盖流式聊天、限流提示、会话管理等场景。可直接打开 `web/index.html`，或执行 `python -m http.server 3000 --directory web` 启动本地静态服务。

## 开发与测试
在项目根目录执行以下命令：

```powershell
pytest
ruff check app
black app
```

更多格式与质量规范详见 `pyproject.toml` 中的 ruff、black、isort 配置。

## 相关文档
- `AGENTS.md` —— 详细介绍 LangGraph 工作流与扩展方式。
- `schema.sql` / `init.sql` —— 数据库结构参考与初始化脚本。
- `scripts/*.sh` —— Docker 构建、运行与日志管理脚本。

## 许可证
本项目采用 [MIT License](LICENSE)。
