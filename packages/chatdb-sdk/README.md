# chatdb

Chat with your database using natural language. Connect any LLM to PostgreSQL, MySQL, or SQLite and get structured query results from plain English questions.

```typescript
import { ChatDB } from '@tiveor/chatdb'

const db = new ChatDB({
  database: 'postgresql://localhost/mydb',
  llm: { apiKey: process.env.OPENAI_API_KEY }
})

const result = await db.query('how many users signed up this month?')
console.log(result.sql)         // SELECT COUNT(*) FROM users WHERE created_at >= ...
console.log(result.explanation) // "Count of users who signed up in the current month"
console.log(result.rows)       // [{ count: 142 }]
```

## Install

```bash
npm install @tiveor/chatdb
```

Install the driver for your database:

```bash
# PostgreSQL
npm install pg

# MySQL
npm install mysql2

# SQLite
npm install better-sqlite3
```

## Quick Start

### Two environment variables

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
export OPENAI_API_KEY=sk-...
```

```typescript
import { ChatDB } from '@tiveor/chatdb'

const db = new ChatDB({
  database: process.env.DATABASE_URL,
  llm: { apiKey: process.env.OPENAI_API_KEY }
})

const result = await db.query('top 10 customers by revenue')
// result.sql         → the generated SQL
// result.explanation → human-readable explanation
// result.chartType   → "bar" | "line" | "pie" | "table" | "number"
// result.columns     → ["name", "total_revenue"]
// result.rows        → [{ name: "Acme", total_revenue: 50000 }, ...]
// result.rowCount    → 10

await db.close()
```

### With different providers

```typescript
// OpenAI
const db = new ChatDB({
  database: 'postgresql://localhost/mydb',
  llm: { apiKey: 'sk-...' }  // auto-detects OpenAI from sk- prefix
})

// Anthropic
const db = new ChatDB({
  database: 'mysql://root:pass@localhost/shop',
  llm: { apiKey: 'sk-ant-...' }  // auto-detects Anthropic from sk-ant- prefix
})

// Local LLM (Ollama, LM Studio, vLLM)
const db = new ChatDB({
  database: './data.sqlite',
  llm: { url: 'http://localhost:11434' }  // auto-detects OpenAI-compatible
})

// Explicit configuration
const db = new ChatDB({
  database: {
    url: 'postgresql://localhost/mydb',
    dialect: 'postgresql',
    poolSize: 10,
  },
  llm: {
    provider: 'openai',
    apiKey: 'sk-...',
    model: 'gpt-4o',
    temperature: 0.1,
  },
  maxRows: 500,
  schema: 'analytics',
  debug: true,
})
```

## Stateful Conversations

Use `ask()` to maintain conversation context across questions:

```typescript
const db = new ChatDB({
  database: process.env.DATABASE_URL,
  llm: { apiKey: process.env.OPENAI_API_KEY }
})

await db.ask('how many orders were placed in January?')
await db.ask('and in February?')       // understands context
await db.ask('which month had more?')  // references both results

db.clearHistory()  // reset conversation
```

## CLI

Chat with your database from the terminal:

```bash
# Interactive REPL
npx @tiveor/chatdb -d postgresql://localhost/mydb -k sk-...

# Single query
npx @tiveor/chatdb -d ./data.sqlite -l http://localhost:11434 -q "top 5 products" --json
```

### REPL commands

```
chatdb> how many users are there?

SQL: SELECT COUNT(*) FROM users
Count of all users in the database.

  count
  -----
  1,847

chatdb> .tables          # list tables
chatdb> .schema          # show database schema
chatdb> .clear           # clear conversation history
chatdb> .exit            # exit
```

### Environment variables

| Variable | Fallback | Description |
|---|---|---|
| `CHATDB_DATABASE_URL` | `DATABASE_URL` | Connection string |
| `CHATDB_LLM_API_KEY` | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | API key |
| `CHATDB_LLM_URL` | `OLLAMA_URL` | LLM endpoint (local) |
| `CHATDB_LLM_MODEL` | `OLLAMA_MODEL` | Model name |

## API Reference

### `new ChatDB(config)`

| Option | Type | Default | Description |
|---|---|---|---|
| `database` | `string \| DatabaseConfig` | required | Connection string or config object |
| `llm` | `string \| LLMProviderConfig` | required | API key, URL, or config object |
| `schema` | `string` | auto | Default schema name |
| `maxRows` | `number` | `1000` | Max rows per query (LIMIT enforced) |
| `queryTimeout` | `number` | `10000` | Query timeout in ms |
| `schemaCacheTTL` | `number` | `300000` | Schema cache TTL in ms (5 min) |
| `allowWrites` | `boolean` | `false` | Allow INSERT/UPDATE/DELETE |
| `debug` | `boolean` | `false` | Include debug info in results |

### `db.query(question, options?)`

Stateless query. Returns `ChatDBResult`:

```typescript
interface ChatDBResult {
  sql: string
  explanation: string
  chartType: 'bar' | 'line' | 'pie' | 'table' | 'number'
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  debug?: DebugInfo  // when debug: true
}
```

Options:
- `schema` — override the default schema for this query
- `history` — pass conversation history for context

### `db.ask(question)`

Stateful query. Same return type as `query()`, but maintains internal conversation history.

### `db.clearHistory()`

Reset the conversation history.

### `db.refreshSchema()`

Clear the cached database schema. Next query will fetch fresh schema.

### `db.listSchemas()`

Returns `string[]` of available schemas/databases.

### `db.listTables(schema?)`

Returns `string[]` of tables in the given schema.

### `db.getSchema(schema?)`

Returns the schema as compact text: `users(id bigint, name varchar)`.

### `db.close()`

Close all database connections.

## Database Auto-Detection

The dialect is detected from the connection string:

| Prefix | Dialect |
|---|---|
| `postgresql://`, `postgres://`, `pg://` | PostgreSQL |
| `mysql://`, `mariadb://` | MySQL |
| `*.sqlite`, `*.db`, `./path`, `/path` | SQLite |

## LLM Auto-Detection

The provider is detected from the configuration:

| Input | Provider |
|---|---|
| API key starting with `sk-ant-` | Anthropic |
| API key starting with `sk-` | OpenAI |
| URL string | OpenAI-compatible (Ollama, LM Studio, vLLM) |

## Safety

By default, chatdb only allows `SELECT` queries. Any write operation (INSERT, UPDATE, DELETE, DROP, etc.) is blocked before reaching your database.

- SQL validation rejects all non-SELECT statements
- Multiple statements (`;`) are blocked
- `LIMIT` is automatically enforced on all queries
- Set `allowWrites: true` to enable write operations

## License

MIT
