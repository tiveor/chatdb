// Main class
export { ChatDB } from "./chatdb.js";

// Types
export type {
  ChatDBConfig,
  ChatDBResult,
  ChatMessage,
  QueryResult,
  ChartType,
  DatabaseDialect,
  LLMProviderType,
  LLMProviderConfig,
  DatabaseConfig,
  DebugInfo,
} from "./types.js";

// LLM Providers
export type { LLMProvider, LLMMessage, LLMGenerateOptions, LLMGenerateResult } from "./llm/types.js";
export { OpenAICompatibleProvider } from "./llm/openai-compatible.js";
export { OpenAIProvider } from "./llm/openai.js";
export { AnthropicProvider } from "./llm/anthropic.js";

// Database Adapters
export type { DatabaseAdapter, QueryResultRaw, TableColumnInfo } from "./db/types.js";
export { PostgresAdapter } from "./db/postgres.js";
export { MySQLAdapter } from "./db/mysql.js";
export { SQLiteAdapter } from "./db/sqlite.js";

// Guard (reusable standalone)
export { validateSQL, ensureLimit } from "./guard/sql-guard.js";

// Errors
export {
  ChatDBError,
  ValidationError,
  LLMError,
  DatabaseError,
  ContextOverflowError,
} from "./utils/errors.js";
