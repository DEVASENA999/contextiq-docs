# DocGPT FastAPI Backend

FastAPI + LangChain + ChromaDB + JWT auth. Gemini or OpenAI as the LLM.

## Run with Docker

```bash
cp .env.example .env       # fill in JWT_SECRET and GOOGLE_API_KEY or OPENAI_API_KEY
docker compose up --build
```

API is then live at `http://localhost:8000` (docs at `/docs`).

## Run locally (no Docker)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

## Endpoints

| Method | Path | Body | Auth |
|---|---|---|---|
| POST | `/auth/register` | `{email,password}` | – |
| POST | `/auth/login` | `{email,password}` | – |
| GET | `/auth/me` | – | Bearer |
| GET | `/documents` | – | Bearer |
| POST | `/documents/upload` | multipart `file` | Bearer |
| DELETE | `/documents/{id}` | – | Bearer |
| POST | `/chat/ask` | `{question,k?}` | Bearer |
| POST | `/search` | `{query,k?}` | Bearer |

## Connect the frontend

In the React app set:

```
VITE_API_BASE_URL=http://localhost:8000
```

Then use `src/lib/api-client.ts` (FastApiClient) for all calls.
