export type ChartType = "bar" | "line" | "pie" | "table" | "number";
export type DatabaseDialect = "postgresql" | "mysql" | "sqlite";
export type LLMProviderType = "openai" | "anthropic" | "openai-compatible";

export interface ChatDBConfig {
  /** Database connection string or config object. Auto-detects dialect from prefix. */
  database: string | DatabaseConfig;

  /** LLM provider configuration. Can be an API key string, URL string, or config object. */
  llm: string | LLMProviderConfig;

  /** Default schema/database name. Defaults: "public" (PG), database name (MySQL), "main" (SQLite). */
  schema?: string;

  /** Maximum rows returned per query. Default: 1000 */
  maxRows?: number;

  /** Query timeout in milliseconds. Default: 10000 */
  queryTimeout?: number;

  /** Schema cache TTL in milliseconds. Default: 300000 (5 min) */
  schemaCacheTTL?: number;

  /** Allow write operations (INSERT, UPDATE, DELETE, etc). Default: false */
  allowWrites?: boolean;

  /** Enable debug info in results. Default: false */
  debug?: boolean;
}

export interface DatabaseConfig {
  /** Connection string (postgresql://, mysql://, or file path for SQLite). */
  url: string;

  /** Explicit dialect override. Auto-detected from url prefix if omitted. */
  dialect?: DatabaseDialect;

  /** Max connections in pool. Default: 5 */
  poolSize?: number;
}

export interface LLMProviderConfig {
  /** Provider type. Auto-detected from url/apiKey if omitted. */
  provider?: LLMProviderType;

  /** API endpoint URL. Required for openai-compatible. */
  url?: string;

  /** API key. Required for openai and anthropic. */
  apiKey?: string;

  /** Model name. Auto-detected if omitted. */
  model?: string;

  /** Context window size override. Auto-detected if omitted. */
  contextLength?: number;

  /** Temperature for generation. Default: 0.1 */
  temperature?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  data?: QueryResult;
}

export interface QueryResult {
  sql: string;
  explanation: string;
  chartType: ChartType;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface ChatDBResult extends QueryResult {
  /** Debug information (only when debug: true). */
  debug?: DebugInfo;
}

export interface DebugInfo {
  model: string;
  contextLength: number;
  systemTokens: number;
  userTokens: number;
  historyTokens: number;
  historyMessages: number;
  schemaTruncated: boolean;
  durationMs: number;
  dialect: DatabaseDialect;
}
