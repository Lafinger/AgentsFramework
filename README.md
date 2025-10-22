# AgentsFramework

[![Python](https://img.shields.io/badge/python-3.13%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 面向生产环境的智能体服务框架：基于 FastAPI 构建，内置 LangGraph 工作流编排、Langfuse 观测、Prometheus 指标、身份认证与速率限制等功能，帮助团队快速上线可观测、可扩展的 AI Agent 服务。

## 📚 目录
- [项目概览](#-项目概览)
- [核心特性](#-核心特性)
- [系统架构](#-系统架构)
- [快速开始](#-快速开始)
  - [环境依赖](#环境依赖)
  - [本地启动](#本地启动)
  - [Docker 部署](#docker-部署)
- [配置说明](#-配置说明)
- [API 速览](#-api-速览)
- [观测与运维](#-观测与运维)
- [评测工作流](#-评测工作流)
- [开发规范](#-开发规范)
- [项目结构](#-项目结构)
- [路线图](#-路线图)
- [许可证](#-许可证)

## 🔍 项目概览
AgentsFramework 提供了一套工程化的 Agent 服务基架，整合了会话管理、用户认证、LangGraph 智能体编排以及运行时指标采集能力。项目默认使用 PostgreSQL 保存用户与会话记录，通过 Langfuse 追踪链路表现，并暴露 Prometheus 指标便于接入 Grafana 进行可视化监控。

## ✨ 核心特性
- **LangGraph 智能体编排**：`app/core/langgraph/graph.py` 封装 LangGraph 调用链，支持普通回复与 SSE 流式输出，便于拓展多工具智能体。
- **完善的身份认证**：`app/api/v1/auth.py` 提供注册、登录、Token 验证与会话管理，结合 JWT 和密码加盐哈希保证安全性。
- **多维速率限制**：借助 `slowapi` 与 `app/core/limiter.py`，可为不同端点设置独立访问频率，防止接口滥用。
- **结构化日志与追踪**：`app/core/logging.py` 基于 `structlog` 输出 JSON/控制台日志，Langfuse SDK (`app/main.py`) 负责链路追踪与评估打点。
- **可观测性一体化**：`app/core/metrics.py` 集成 Prometheus 指标（HTTP/LLM 延迟、错误率等），配套 `prometheus/`、`grafana/` 目录提供监控模版。
- **安全输入处理**：`app/utils/sanitization.py` 对邮箱、字符串进行清理，并计划进一步统一参数净化策略。
- **评测工具链**：`evals/` 目录实现 LangGraph 会话评测与报告生成，可快速验证模型策略效果。

## 🛠 系统架构
整体分层如下：

```text
app/
├── api/v1/              # FastAPI 路由（认证、聊天、健康检查）
├── core/                # 配置、日志、速率限制、LangGraph、指标、中间件
├── models/              # SQLModel 定义的 User / Session 等数据模型
├── schemas/             # Pydantic 模型（请求/响应校验）
├── services/database.py # 数据库访问与健康检查
├── utils/               # JWT、输入净化等工具
└── main.py              # 应用入口，注册中间件 & 路由
```

配套设施：
- `web/`：静态 Demo，可在后续接入真实前端。
- `prometheus/` & `grafana/`：监控栈配置，结合 Docker Compose 一键启动。
- `scripts/`：常用运维/开发脚本。
- `evals/`：评测与回归工具，支持 LangGraph 工作流效果验证。

## ⚡ 快速开始

### 环境依赖
- Python 3.13+
- [uv](https://github.com/astral-sh/uv)（推荐的虚拟环境与依赖管理工具）
- PostgreSQL 数据库（默认用于 LangGraph checkpoint 与业务数据存储）

### 本地启动
```bash
# 1. 克隆仓库
git clone https://github.com/<your-org>/AgentsFramework.git
cd AgentsFramework

# 2. 创建虚拟环境并安装依赖
uv venv
uv sync --extra dev --group test

# 3. 配置环境变量（见下文配置说明）
cp .env.example .env.development  # 根据需求调整

# 4. 初始化数据库（可执行 schema.sql 或手动迁移）
psql "$POSTGRES_URL" -f schema.sql

# 5. 启动开发服务器
uv run uvicorn app.main:app --reload
```
启动后：
- API 根路径：`http://localhost:8000/`
- 文档：`/docs` (Swagger) 或 `/redoc`
- 健康检查：`/health`、`/api/v1/health`
- Prometheus 指标：`/metrics`

### Docker 部署
```bash
# 启动应用 + Prometheus + Grafana
docker-compose up --build

# 如需连接外部数据库
docker-compose -f docker-compose-external.yml up -d
```
Docker Compose 默认会启动应用、Prometheus、Grafana 等服务，方便在测试或演示环境中体验完整链路。

## ⚙ 配置说明
所有配置均来自环境变量，`app/core/config.py` 会根据 `APP_ENV` 自动加载对应 `.env` 文件。核心变量如下：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `APP_ENV` | 运行环境（development/staging/production/test） | `development` |
| `PROJECT_NAME` | 项目名称 | `Agents Framework` |
| `API_V1_STR` | API 前缀 | `/api/v1` |
| `POSTGRES_URL` | PostgreSQL 连接字符串 | _必填_ |
| `JWT_SECRET_KEY` | JWT 签发密钥 | _必填_ |
| `LLM_API_KEY` | 大模型调用密钥 | _必填_ |
| `LLM_MODEL` | LangGraph 默认模型 | `gpt-4o-mini` |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Langfuse 访问凭证 | 空 |
| `RATE_LIMIT_*` | 各端点速率限制（如 `RATE_LIMIT_CHAT="30 per minute"`） | 见代码默认值 |
| `LOG_FORMAT` | 日志格式（`json` 或 `console`） | `json` |

更多可选项（如 `POSTGRES_POOL_SIZE`、`MAX_TOKENS`、`EVALUATION_LLM` 等）请参考 `app/core/config.py`。

## 📡 API 速览
主要接口均在 `app/api/v1/` 下定义，可通过 `/docs` 在线调试。

| 模块 | 方法 & 路径 | 描述 |
| --- | --- | --- |
| 认证 (`auth.py`) | `POST /api/v1/auth/register` | 注册用户并返回 JWT |
|  | `POST /api/v1/auth/login` | 表单登录，返回访问令牌 |
|  | `GET /api/v1/auth/sessions` | 获取当前用户的会话列表 |
| 聊天 (`chatbot.py`) | `POST /api/v1/chatbot/chat` | 使用 LangGraph 处理消息，返回完整回复 |
|  | `POST /api/v1/chatbot/chat/stream` | SSE 流式推送生成内容 |
|  | `GET /api/v1/chatbot/messages` | 拉取当前会话历史 |
|  | `DELETE /api/v1/chatbot/messages` | 清空会话历史 |
| 系统 | `GET /`、`GET /health`、`GET /api/v1/health` | 服务状态检查 |

> 所有聊天相关接口都需携带 `Authorization: Bearer <token>`，令牌由认证模块签发。

## 🛡 观测与运维
- **Prometheus**：`app/core/metrics.py` 暴露 HTTP/LLM 指标；`prometheus/prometheus.yml` 中已配置采集目标。
- **Grafana**：`grafana/dashboards/` 提供预配置仪表盘定义，可在 `http://localhost:3000` 导入并查看。
- **日志**：`logs/` 目录写入结构化日志，便于收集到 ELK/ Loki 等系统。
- **速率限制**：`app/core/limiter.py` 基于 SlowAPI，结合 `settings.RATE_LIMIT_ENDPOINTS` 做细粒度控制。

## 🧪 评测工作流
`evals/` 目录提供命令行评测工具，默认读取 `settings.EVALUATION_*` 配置，生成彩色终端报告：

```bash
uv run python -m evals.main
```

评测完成后可在控制台查看成功率、指标摘要，并在生成报告时导出 JSON。具体指标计算逻辑可参见 `evals/evaluator.py` 与 `evals/metrics/`。

## 🧑‍💻 开发规范
- **格式化 / 静态检查**
  ```bash
  uv run ruff check .
  uv run black app tests
  uv run isort app tests
  ```
- **测试**
  ```bash
  uv run pytest -q
  ```
- **提交信息**：遵循仓库 `AGENTS.md` 指南，使用 72 字符以内的祈使句摘要；如有 Issue 请附带编号。

## 🗂 项目结构
```text
.
├── app/                # FastAPI 应用与业务代码
├── web/                # 前端静态页面（可选）
├── evals/              # LangGraph 评测工具
├── scripts/            # 辅助脚本
├── prometheus/         # Prometheus 配置
├── grafana/            # Grafana 配置与仪表盘
├── docker-compose*.yml # Docker 编排文件
├── schema.sql          # 数据库初始化脚本
└── README.md           # 当前文档
```

## 🗺 路线图
- [ ] 扩展 `sanitize_string` 覆盖所有字符串输入，并考虑装饰器统一拦截。
- [ ] 增加更多 LangGraph 工具示例与推理分支。
- [ ] 提供端到端的前端聊天 Demo 与录屏。

## 📄 许可证
本项目基于 [MIT License](LICENSE) 开源，欢迎在遵循许可证的前提下自由使用与修改。
