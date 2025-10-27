# AgentsFramework

> Production-ready FastAPI + LangGraph agent skeleton with built-in authentication, rate limiting, observability, and retrieval helpers.

- 简体中文文档: [README_CN.md](README_CN.md)

## Overview
AgentsFramework accelerates the delivery of OpenAI-compatible chat agents. It couples FastAPI with LangGraph to orchestrate stateful conversations, wraps DuckDuckGo search as a tool node, persists session state in PostgreSQL, and instruments every request with Langfuse, Prometheus metrics, and structured logging.

## Highlights
- **LangGraph workflow** – Stateful agent with `chat` and `tool_call` nodes, message trimming, and retry logic defined in `app/core/langgraph/graph.py`.
- **Secure APIs** – JWT-based auth, session management, and request sanitization via `app/api/v1/auth.py` and `app/utils/sanitization.py`.
- **Tooling & RAG** – Built-in DuckDuckGo search tool plus a lightweight retrieval service exposed under `/api/v1/rag`.
- **Observability** – Prometheus metrics, structlog JSON/console logs, and Langfuse tracing configured in `app/core`.
- **Production guardrails** – Per-endpoint rate limits, Postgres-backed checkpoints, and configurable environment profiles.
- **Developer UX** – Docker & docker-compose recipes, a web playground (`web/`) for manual QA, and opinionated lint/test tooling.

## Architecture at a Glance
- `app/main.py` boots the FastAPI app, rate limiter, metrics middleware, and health endpoints.
- `app/api/v1/` contains REST routers for auth, chatbot, and RAG flows.
- `app/services/` wraps persistence (SQLModel + PostgreSQL) and retrieval helpers.
- `app/core/` hosts configuration, logging, metrics, prompts, and LangGraph tooling.
- `app/schemas/` defines Pydantic contracts for requests, responses, and agent state.

## Directory Layout
```text
app/
├─ api/                     # FastAPI routers
├─ core/                    # Config, logging, prompts, LangGraph workflow
├─ models/                  # SQLModel entities
├─ schemas/                 # Pydantic request/response models
├─ services/                # Database & RAG services
├─ utils/                   # Message prep, auth, sanitization helpers
evals/                      # Evaluation scripts and experiments
grafana/, prometheus/       # Observability stack definitions
scripts/                    # Docker helper scripts
web/                        # Browser-based test client
```

## Prerequisites
- Python 3.13+
- PostgreSQL 14+ (or run via `docker-compose-external.yml`)
- An OpenAI-compatible endpoint and API key
- Optional: Docker/Docker Compose for containerized deployment

## Quick Start
1. **Create a virtual environment**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
2. **Install dependencies**
   ```powershell
   pip install -e .
   ```
3. **Configure environment**
   ```powershell
   Copy-Item .env.example .env.development
   ```
   Update the new file with real values for `LLM_API_KEY`, `POSTGRES_URL`, `JWT_SECRET_KEY`, etc.
4. **Launch the API**
   ```powershell
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
5. Visit `http://localhost:8000/docs` for the interactive Swagger UI or load `web/index.html` for the playground.

## Configuration
Key environment variables (see `.env.example` for the full list):

| Variable | Description | Default |
| --- | --- | --- |
| `APP_ENV` | Environment mode (`development`, `staging`, `production`, `test`) | `development` |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` | Upstream chat model configuration | OpenAI defaults |
| `MAX_TOKENS` / `MAX_LLM_CALL_RETRIES` | LangGraph invocation guardrails | `2000` / `3` |
| `POSTGRES_URL` | PostgreSQL DSN for SQLModel + LangGraph checkpoints | _empty_ |
| `JWT_SECRET_KEY` | Secret used to sign JWT session tokens | _required_ |
| `RATE_LIMIT_*` | Per-endpoint rate limits (SlowAPI syntax) | See defaults in `app/core/config.py` |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | Langfuse instrumentation credentials | _optional_ |
| `LOG_FORMAT` / `LOG_LEVEL` | Structured logging output | `json` & `INFO` |

## Docker Compose
- `docker-compose.yml` runs the API together with Prometheus, Grafana, and cAdvisor:
  ```powershell
  docker compose up --build
  ```
- `docker-compose-external.yml` provisions PostgreSQL + pgAdmin if you do not have a database yet:
  ```powershell
  docker compose -f docker-compose-external.yml up -d
  ```
Mount your `.env.<env>` file and override secrets at runtime for production deployments.

## Observability & Ops
- `/metrics` exposes Prometheus counters and histograms (`http_requests_total`, `llm_inference_duration_seconds`, etc.).
- Structured JSONL logs are saved under `logs/<env>-YYYY-MM-DD.jsonl`; console logging can be enabled per environment.
- Langfuse `CallbackHandler` attaches user/session metadata to each LangGraph run.
- Rate limiting via SlowAPI protects sensitive endpoints and surfaces `429` responses with structured errors.

## API Surface
| Method | Path | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/` | Root metadata and environment info | No |
| `GET` | `/health` | API + database health probe | No |
| `GET` | `/api/v1/health` | Versioned health probe | No |
| `POST` | `/api/v1/auth/register` | Register a new user | No |
| `POST` | `/api/v1/auth/login` | Login and issue JWT token | No |
| `POST` | `/api/v1/auth/session` | Create a chat session + token | Yes |
| `PATCH` | `/api/v1/auth/session/{id}/name` | Rename a session | Yes |
| `DELETE` | `/api/v1/auth/session/{id}` | Delete a session | Yes |
| `GET` | `/api/v1/auth/sessions` | List sessions with fresh tokens | Yes |
| `POST` | `/api/v1/chatbot/chat` | LangGraph-powered chat completion | Yes |
| `POST` | `/api/v1/chatbot/chat/stream` | Streaming SSE response | Yes |
| `GET` | `/api/v1/chatbot/messages` | Retrieve persisted message history | Yes |
| `DELETE` | `/api/v1/chatbot/messages` | Clear persisted message history | Yes |
| `GET` | `/api/v1/rag/documents` | List RAG knowledge base documents | No |
| `POST` | `/api/v1/rag/query` | Retrieve + summarize matching documents | No |

The authentication-protected endpoints expect a `Bearer <token>` header generated by the auth flow.

## Retrieval-Augmented Generation
`app/services/rag.py` exposes an in-memory JSON-backed knowledge base with Jaccard scoring. The `/api/v1/rag/query` route returns a synthesized answer plus ranked sources, making it easy to plug LangGraph outputs into an augmented workflow.

## Frontend Playground
The `web/` directory contains a pure HTML/JS interface that exercises the entire API surface, including streaming chat, rate-limited endpoints, and session management. Serve it locally (e.g., `python -m http.server 3000 --directory web`) or open `web/index.html` directly.

## Testing & Quality
Run the included tooling from the project root:

```powershell
pytest
ruff check app
black app
```

See `pyproject.toml` for the full lint/test configuration, including `isort` and formatting conventions.

## Additional Resources
- `AGENTS.md` – Deep dive into the LangGraph agent workflow and extension points.
- `schema.sql` / `init.sql` – Reference SQL definitions for local database setup.
- `scripts/*.sh` – Docker helper scripts for build/run/log workflows.

## License
AgentsFramework is released under the [MIT License](LICENSE).
