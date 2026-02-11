import type { ChatDBConfig, ChatDBResult, ChatMessage, DatabaseDialect } from "./types.js";
import type { LLMProvider, LLMMessage } from "./llm/types.js";
import type { DatabaseAdapter } from "./db/types.js";
import { resolveLLMProvider } from "./llm/registry.js";
import { resolveDatabaseAdapter } from "./db/registry.js";
import { validateSQL, ensureLimit } from "./guard/sql-guard.js";
import { buildSystemPrompt } from "./prompt/system.js";
import { estimateTokens, truncateSchema } from "./utils/tokens.js";
import { ChatDBError, ValidationError, ContextOverflowError } from "./utils/errors.js";

interface SchemaCache {
  text: string;
  time: number;
}

export class ChatDB {
  private llm!: LLMProvider;
  private db!: DatabaseAdapter;
  private config: {
    maxRows: number;
    queryTimeout: number;
    schemaCacheTTL: number;
    allowWrites: boolean;
    debug: boolean;
  };
  private defaultSchema!: string;
  private history: ChatMessage[] = [];
  private schemaCache = new Map<string, SchemaCache>();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private rawConfig: ChatDBConfig;

  constructor(config: ChatDBConfig) {
    this.rawConfig = config;
    this.config = {
      maxRows: config.maxRows ?? 1000,
      queryTimeout: config.queryTimeout ?? 10_000,
      schemaCacheTTL: config.schemaCacheTTL ?? 5 * 60 * 1000,
      allowWrites: config.allowWrites ?? false,
      debug: config.debug ?? false,
    };
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.db = await resolveDatabaseAdapter(this.rawConfig.database, this.config.queryTimeout);
      this.llm = await resolveLLMProvider(this.rawConfig.llm);
      this.defaultSchema = this.rawConfig.schema ?? this.db.defaultSchema;
      this.initialized = true;
    })();

    return this.initPromise;
  }

  /** The dialect of the connected database. */
  get dialect(): DatabaseDialect {
    return this.db.dialect;
  }

  /**
   * Ask a natural language question, get structured results.
   * Stateless — pass history explicitly if needed.
   */
  async query(
    message: string,
    options?: { schema?: string; history?: ChatMessage[] },
  ): Promise<ChatDBResult> {
    await this.init();

    const schema = options?.schema ?? this.defaultSchema;
    const history = options?.history ?? [];
    const startTime = Date.now();

    // 1. Get cached schema text
    const schemaText = await this.getCachedSchema(schema);

    // 2. Get LLM context info
    const contextLength = await this.llm.getContextLength();

    // 3. Build messages with token budgeting
    const { messages, stats } = this.buildMessages(schemaText, history, message, contextLength, schema);

    // 4. Call LLM
    const result = await this.llm.generate({
      messages,
      temperature: 0.1,
      maxTokens: 256,
    });

    // 5. Parse response
    let parsed: { sql: string; explanation: string; chartType: string };
    try {
      parsed = JSON.parse(result.content);
    } catch {
      throw new ChatDBError(`Failed to parse LLM response as JSON: ${result.content}`);
    }

    if (!parsed.sql || !parsed.explanation) {
      throw new ChatDBError("Invalid AI response: missing sql or explanation");
    }

    // 6. Clean up SQL
    parsed.sql = parsed.sql
      .replace(/\\"/g, '"')
      .replace(/\\n/g, " ")
      .replace(/\\\\/g, "\\")
      .trim();

    // Strip schema prefix from table names
    const schemaPrefix = new RegExp(
      `(?:"?${schema.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?\\.)|(?:${schema.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.)`,
      "gi",
    );
    parsed.sql = parsed.sql.replace(schemaPrefix, "");

    // 7. Validate SQL
    const validation = validateSQL(parsed.sql, { allowWrites: this.config.allowWrites });
    if (!validation.valid) {
      throw new ValidationError(validation.error!, parsed.sql);
    }

    // 8. Ensure LIMIT
    const safeSql = ensureLimit(parsed.sql, this.config.maxRows);

    // 9. Execute query
    const queryResult = await this.db.execute(safeSql, schema);

    const chartType = (parsed.chartType as ChatDBResult["chartType"]) ?? "table";

    return {
      sql: safeSql,
      explanation: parsed.explanation,
      chartType,
      columns: queryResult.columns,
      rows: queryResult.rows,
      rowCount: queryResult.rowCount,
      ...(this.config.debug
        ? {
            debug: {
              model: result.model,
              contextLength,
              ...stats,
              durationMs: Date.now() - startTime,
              dialect: this.db.dialect,
            },
          }
        : {}),
    };
  }

  /**
   * Stateful conversation. Uses internal history automatically.
   */
  async ask(message: string): Promise<ChatDBResult> {
    const result = await this.query(message, { history: this.history });
    this.history.push(
      { role: "user", content: message },
      { role: "assistant", content: result.explanation, data: result },
    );
    return result;
  }

  /** Clear conversation history. */
  clearHistory(): void {
    this.history = [];
  }

  /** Refresh the cached database schema. */
  refreshSchema(): void {
    this.schemaCache.clear();
  }

  /** Get the database schema as text. */
  async getSchema(schemaName?: string): Promise<string> {
    await this.init();
    return this.db.getSchemaText(schemaName ?? this.defaultSchema);
  }

  /** List available schemas/databases. */
  async listSchemas(): Promise<string[]> {
    await this.init();
    return this.db.listSchemas();
  }

  /** List tables in a schema. */
  async listTables(schemaName?: string): Promise<string[]> {
    await this.init();
    return this.db.listTables(schemaName ?? this.defaultSchema);
  }

  /** Close all connections and clean up. */
  async close(): Promise<void> {
    if (this.initialized) {
      await this.db.close();
    }
  }

  private async getCachedSchema(schemaName: string): Promise<string> {
    const now = Date.now();
    const cached = this.schemaCache.get(schemaName);
    if (cached && now - cached.time < this.config.schemaCacheTTL) {
      return cached.text;
    }
    const text = await this.db.getSchemaText(schemaName);
    this.schemaCache.set(schemaName, { text, time: now });
    return text;
  }

  private buildMessages(
    schema: string,
    history: ChatMessage[],
    message: string,
    maxTokens: number,
    schemaName: string,
  ) {
    const responseReserve = 256;
    const systemPromptBase = buildSystemPrompt(this.db.dialect, "", schemaName);
    const rulesTokens = estimateTokens(systemPromptBase);
    const userTokens = estimateTokens(message);

    const schemaBudget = maxTokens - rulesTokens - userTokens - responseReserve - 50;
    const { text: trimmedSchema, truncated: schemaTruncated } = truncateSchema(
      schema,
      Math.max(schemaBudget, 200),
    );

    const systemPrompt = buildSystemPrompt(this.db.dialect, trimmedSchema, schemaName);
    const systemMsg: LLMMessage = { role: "system", content: systemPrompt };
    const userMsg: LLMMessage = { role: "user", content: message };

    const systemTokens = estimateTokens(systemPrompt);
    const usedTokens = systemTokens + userTokens + responseReserve;
    let availableForHistory = maxTokens - usedTokens;

    if (availableForHistory <= 0) {
      return {
        messages: [systemMsg, userMsg],
        stats: {
          systemTokens,
          userTokens,
          historyTokens: 0,
          historyMessages: 0,
          schemaTruncated,
        },
      };
    }

    const historyMsgs: LLMMessage[] = [];
    const recent = [...history].reverse();
    let historyTokens = 0;

    for (const msg of recent) {
      const content =
        msg.role === "user"
          ? msg.content
          : JSON.stringify({
              sql: msg.data?.sql ?? "",
              explanation: msg.content,
              chartType: msg.data?.chartType ?? "table",
            });

      const tokens = estimateTokens(content);
      if (tokens > availableForHistory) break;

      availableForHistory -= tokens;
      historyTokens += tokens;
      historyMsgs.unshift({ role: msg.role, content });
    }

    return {
      messages: [systemMsg, ...historyMsgs, userMsg],
      stats: {
        systemTokens,
        userTokens,
        historyTokens,
        historyMessages: historyMsgs.length,
        schemaTruncated,
      },
    };
  }
}
