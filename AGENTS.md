# Repository Guidelines

## Project Structure & Module Organization
- Backend (`app/`): entry `app/main.py`; routes `app/api/v1/{auth,chatbot}.py`; config/metrics/logging/rate-limit in `app/core/`; LangGraph in `app/core/langgraph/`; prompts in `app/core/prompts/`.
- Data: models in `app/models/` (SQLModel), schemas in `app/schemas/`.
- Services & Utils: DB service in `app/services/database.py`; auth/jwt helpers in `app/utils/auth.py`.
- Frontend: `web/` static demo (`index.html`, `app.js`).
- Ops: `Dockerfile`, `docker-compose*.yml`, `prometheus/`, `grafana/`, `scripts/`, logs in `logs/`.

## Build, Run, and Test
- Env setup (uv): `uv venv && uv sync --extra dev --group test`.
- Run (dev): `uv run uvicorn app.main:app --reload` (http://localhost:8000, metrics at `/metrics`, health at `/health` and `/api/v1/health`).
- Lint/Format: `uv run ruff check .`; `uv run ruff --fix .`; `uv run black app tests`; `uv run isort app tests`.
- Test: `uv run pytest -q` (pytest configured via `pyproject.toml`; slow tests use `-m "not slow"`).
- Docker: `docker-compose up --build` (app+Prometheus+Grafana). Optional local DB: `docker-compose -f docker-compose-external.yml up -d`.

## Coding Style & Naming
- Python 3.13. Black line length 119; isort `profile=black`; Ruff/Flake8 enabled; Google-style docstrings.
- Names: files/modules `snake_case`; classes `PascalCase`; functions/vars `snake_case`; constants `UPPER_SNAKE_CASE`.
- API routers under `app/api/v1/` must expose `router`.

## Testing Guidelines
- Use pytest; prefer async HTTP tests with `httpx.AsyncClient` against the FastAPI app.
- Layout: mirror packages under `tests/` (e.g., `tests/api/v1/test_auth.py`, `tests/core/test_config.py`).
- Conventions: `test_*`/`*_test.py`; use `@pytest.mark.slow` where appropriate.

## Commit & Pull Request Guidelines
- Commits: concise subject (Chinese or English), imperative mood, ≤72 chars; reference issues (e.g., `feat: add session rename (#123)`).
- PRs: include description, linked issues, test steps, and screenshots/GIFs for `web/` changes. Require green lint/format/tests and updated docs/`.env.example` for config changes.

## Security & Configuration
- Required env: `JWT_SECRET_KEY`, `LLM_API_KEY`; DB via `POSTGRES_URL`; optional `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`.
- Rate limits: defaults in code; override with `RATE_LIMIT_{ENDPOINT}` (e.g., `RATE_LIMIT_CHAT="30 per minute"`).
- Copy `.env.example` → `.env.development`; never commit secrets. Metrics served at `/metrics`.

## Agent-Specific Notes
- LangGraph: add tools under `app/core/langgraph/tools/` and register in `tools/__init__.py`; state graph lives in `app/core/langgraph/graph.py`.
