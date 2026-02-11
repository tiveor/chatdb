import type { ChatDBResult } from "../types.js";

export function printTable(result: ChatDBResult): void {
  if (result.rowCount === 0) {
    console.log("  (no rows returned)\n");
    return;
  }

  const { columns, rows } = result;

  // Calculate column widths
  const widths = columns.map((col) => col.length);
  for (const row of rows) {
    for (let i = 0; i < columns.length; i++) {
      const val = formatValue(row[columns[i]]);
      widths[i] = Math.min(Math.max(widths[i], val.length), 40);
    }
  }

  // Header
  const header = columns.map((col, i) => col.padEnd(widths[i])).join(" | ");
  const separator = widths.map((w) => "-".repeat(w)).join("-+-");

  console.log(`  ${header}`);
  console.log(`  ${separator}`);

  // Rows (max 20 in terminal)
  const displayRows = rows.slice(0, 20);
  for (const row of displayRows) {
    const line = columns
      .map((col, i) => {
        const val = formatValue(row[col]);
        return val.length > widths[i] ? val.slice(0, widths[i] - 1) + "…" : val.padEnd(widths[i]);
      })
      .join(" | ");
    console.log(`  ${line}`);
  }

  if (rows.length > 20) {
    console.log(`  ... and ${rows.length - 20} more rows`);
  }
  console.log();
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

export function printHelp(): void {
  console.log(`
chatdb - Chat with your database using natural language

USAGE:
  chatdb [options]
  chatdb -q "your question" [options]

OPTIONS:
  -d, --database <url>    Database connection string
  -k, --api-key <key>     LLM API key (OpenAI or Anthropic)
  -l, --llm <url>         LLM endpoint URL (for Ollama/local)
  -p, --provider <type>   LLM provider: openai, anthropic, openai-compatible
  -m, --model <name>      Model name
  -s, --schema <name>     Default schema name
  -q, --query <question>  Run a single query and exit
      --json              Output as JSON (with -q)
  -h, --help              Show this help
  -v, --version           Show version

ENVIRONMENT VARIABLES:
  CHATDB_DATABASE_URL     Database URL (or DATABASE_URL)
  CHATDB_LLM_API_KEY      LLM API key (or OPENAI_API_KEY / ANTHROPIC_API_KEY)
  CHATDB_LLM_URL          LLM endpoint (or OLLAMA_URL)
  CHATDB_LLM_MODEL        Model name (or OLLAMA_MODEL)

REPL COMMANDS:
  .tables                 List tables
  .schema                 Show database schema
  .clear                  Clear conversation history
  .exit                   Exit the REPL

EXAMPLES:
  chatdb -d postgresql://localhost/mydb -k sk-...
  chatdb -d ./data.sqlite -l http://localhost:11434
  chatdb -q "top 10 customers by revenue" --json
`);
}
