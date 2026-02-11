# ChatDB

Talk to your PostgreSQL database in natural language. Ask questions, get SQL, tables, and charts back — like chatting with a data analyst.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)

## How It Works

```
You: "How many orders were placed last month?"
        |
        v
  [Hono API Server]
        |
   Gets your DB schema (cached)
        |
        v
  [Local LLM via OpenAI API]
   Schema + question → SQL + chart type
        |
        v
  [SQL Guard] ← blocks anything that isn't SELECT
        |
        v
  [PostgreSQL] → executes query
        |
        v
  Table + Chart + Explanation
```

1. You type a question in plain language
2. The server sends your DB schema + question to a local LLM
3. The LLM generates a `SELECT` query + picks a chart type
4. A SQL guard validates the query is read-only (blocks INSERT, DELETE, DROP, etc.)
5. The query runs against your database with a 10s timeout and 1000 row limit
6. You see the explanation, an auto-generated chart, and a data table

## Features

- **Natural language queries** — ask in any language, get SQL back
- **Auto-visualization** — bar, line, pie charts, big number stats, or tables based on data shape
- **Schema-aware** — switch between database schemas on the fly
- **Read-only safety** — SQL guard blocks all mutations, enforces LIMIT, 10s timeout
- **Conversational context** — follow-up questions work ("and what about February?")
- **Context management** — auto-trims history and schema to fit model context window
- **Export** — download results as CSV or JSON
- **Debug panel** — live logs showing model info, token usage, generated SQL, timing
- **Works with any OpenAI-compatible API** — LM Studio, Ollama, vLLM, text-generation-webui, etc.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 7, Tailwind CSS 4, Recharts |
| Backend | Hono (Node adapter), TypeScript |
| Database | PostgreSQL via `pg` (works with Supabase, Neon, local, etc.) |
| AI | Any OpenAI-compatible API (`/v1/chat/completions`) |
| Monorepo | pnpm workspaces |

## Project Structure

```
chatdb/
├── package.json              # Root workspace
├── pnpm-workspace.yaml
├── .env                      # Your config (not committed)
├── .env.example
│
├── server/
│   └── src/
│       ├── index.ts           # Hono server, CORS, routes
│       ├── routes/
│       │   ├── chat.ts        # POST /api/chat — main flow
│       │   └── schema.ts      # GET /api/schema/* — introspection
│       ├── services/
│       │   ├── ollama.ts      # LLM client, prompt engineering, token budgeting
│       │   ├── database.ts    # pg pool, query execution, schema isolation
│       │   ├── schema.ts      # DB introspection + cache
│       │   └── sql-guard.ts   # Read-only validation, LIMIT enforcement
│       └── types.ts
│
├── client/
│   └── src/
│       ├── App.tsx            # Main layout, schema selector
│       ├── components/
│       │   ├── ChatWindow.tsx     # Message container
│       │   ├── MessageBubble.tsx  # User/AI message with data display
│       │   ├── ChatInput.tsx      # Input with send
│       │   ├── DataTable.tsx      # Query results table
│       │   ├── ChartRenderer.tsx  # Auto bar/line/pie/number chart
│       │   ├── ExportButton.tsx   # CSV/JSON export
│       │   └── LogPanel.tsx       # Debug side panel
│       ├── hooks/
│       │   └── useChat.ts        # Chat state management
│       ├── services/
│       │   └── api.ts            # API client
│       └── types.ts
```

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8 (`npm install -g pnpm`)
- **PostgreSQL database** — Supabase, Neon, local, any Postgres
- **Local LLM server** with OpenAI-compatible API — see [LLM Setup](#llm-setup)

### 1. Clone and install

```bash
git clone https://github.com/tiveor/chatdb.git
cd chatdb
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Your Postgres connection string
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Your LLM server endpoint
OLLAMA_URL=http://localhost:1234
```

### 3. Start development

```bash
pnpm dev
```

This starts both:
- **Client** at `http://localhost:5173`
- **Server** at `http://localhost:3001`

Open `http://localhost:5173` and start chatting with your database.

## LLM Setup

ChatDB works with any server that exposes an OpenAI-compatible `/v1/chat/completions` endpoint. Here are some options:

### LM Studio (recommended for beginners)

1. Download [LM Studio](https://lmstudio.ai/)
2. Download a model (recommended: `qwen2.5-coder-7b` or `deepseek-coder-v2`)
3. Go to **Local Server** tab, start the server
4. Set `OLLAMA_URL=http://localhost:1234` in your `.env`

> **Tip:** Load the model with at least 4096 context length for best results. Smaller context = more aggressive schema/history trimming.

### Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3

# Ollama runs on port 11434 by default
```

Set `OLLAMA_URL=http://localhost:11434` in your `.env`.

### vLLM

```bash
vllm serve Qwen/Qwen2.5-Coder-7B-Instruct --port 8000
```

Set `OLLAMA_URL=http://localhost:8000` in your `.env`.

### Remote LLM on another machine

If your LLM runs on a different machine (e.g., a GPU server):

```env
OLLAMA_URL=http://192.168.0.21:1234
```

## API Reference

### `POST /api/chat`

Send a natural language message, get SQL results back.

**Request:**
```json
{
  "message": "How many users signed up this month?",
  "schemaName": "public",
  "history": [
    { "role": "user", "content": "previous question" },
    { "role": "assistant", "content": "previous answer", "data": { "sql": "..." } }
  ]
}
```

**Response:**
```json
{
  "text": "There were 142 new signups this month.",
  "data": {
    "sql": "SELECT COUNT(*) AS signups FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE) LIMIT 1000",
    "explanation": "There were 142 new signups this month.",
    "chartType": "number",
    "columns": ["signups"],
    "rows": [{ "signups": 142 }],
    "rowCount": 1
  },
  "logs": [
    "Schema: public",
    "Schema text: 1234 chars",
    "Model: qwen2.5-coder-7b-instruct",
    "Duration: 2340ms"
  ]
}
```

### `GET /api/schema/list`

Returns all available database schemas.

### `GET /api/schema/tables?name=public`

Returns table names for a given schema.

### `GET /api/schema?name=public`

Returns the full schema text (used internally for LLM context).

### `POST /api/schema/refresh`

Clears the schema cache (5 min TTL by default).

### `GET /api/health`

Health check endpoint.

## Security

ChatDB is designed for **read-only access** to your database:

- **SQL Guard** validates every query before execution:
  - Only `SELECT` and `WITH` (CTEs) are allowed
  - Blocks: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE`, `EXEC`, `COPY`
  - Blocks multiple statements (`;`)
- **LIMIT 1000** is enforced on every query (added if missing)
- **10 second timeout** per query
- **Connection pooling** with max 5 connections
- **CORS** restricted to the frontend origin
- Database credentials stay server-side only

> **Recommendation:** Use a read-only database user/role for extra safety:
> ```sql
> CREATE ROLE chatdb_reader WITH LOGIN PASSWORD 'your-password';
> GRANT USAGE ON SCHEMA public TO chatdb_reader;
> GRANT SELECT ON ALL TABLES IN SCHEMA public TO chatdb_reader;
> ```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `OLLAMA_URL` | No | `http://localhost:11434` | OpenAI-compatible API endpoint |
| `OLLAMA_MODEL` | No | Auto-detected | Force a specific model name |
| `PORT` | No | `3001` | Server port |

## Scripts

```bash
# Run both client and server in dev mode
pnpm dev

# Run only the server
pnpm dev:server

# Run only the client
pnpm dev:client

# Build the client for production
pnpm --filter client build
```

## Troubleshooting

### "database 'xxx' does not exist"
Your `DATABASE_URL` is wrong or not set. Make sure the `.env` file is in the project root (not inside `server/` or `client/`).

### "AI server error (400): response_format.type must be 'json_schema' or 'text'"
Your LLM server doesn't support structured output. Make sure you're using a recent version of LM Studio, Ollama, or vLLM.

### "context overflow" on every message
Your model is loaded with a very small context window. In LM Studio, increase the context length to at least 4096 tokens in the model settings. ChatDB auto-detects the context length and trims schema/history to fit.

### Queries go to the wrong schema
Make sure you select the correct schema from the dropdown in the header. The schema name is passed both to the AI prompt and to `SET search_path` before query execution.

### Charts don't render
Charts only render when the AI returns a `chartType` other than `table` and the data has at least one numeric column. Ask questions that produce numeric results (counts, sums, averages).

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

MIT - Alvaro Orellana
