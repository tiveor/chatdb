import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatDB } from "../chatdb.js";
import { ChatDBError, ValidationError } from "../utils/errors.js";
import type { LLMProvider } from "../llm/types.js";
import type { DatabaseAdapter } from "../db/types.js";

// Mock the registries to inject our test doubles
vi.mock("../llm/registry.js", () => ({
  resolveLLMProvider: vi.fn(),
}));
vi.mock("../db/registry.js", () => ({
  resolveDatabaseAdapter: vi.fn(),
}));

const { resolveLLMProvider } = await import("../llm/registry.js");
const { resolveDatabaseAdapter } = await import("../db/registry.js");

function createMockLLM(response?: string): LLMProvider {
  return {
    name: "test-llm",
    generate: vi.fn().mockResolvedValue({
      content: response ?? '{"sql":"SELECT COUNT(*) FROM users","explanation":"Count all users","chartType":"number"}',
      model: "test-model",
    }),
    getContextLength: vi.fn().mockResolvedValue(4096),
    getModelId: vi.fn().mockResolvedValue("test-model"),
  };
}

function createMockDB(): DatabaseAdapter {
  return {
    dialect: "postgresql",
    defaultSchema: "public",
    execute: vi.fn().mockResolvedValue({
      columns: ["count"],
      rows: [{ count: 42 }],
      rowCount: 1,
    }),
    rawQuery: vi.fn().mockResolvedValue([]),
    getSchemaText: vi.fn().mockResolvedValue("users(id bigint, name varchar)\norders(id bigint, total numeric)"),
    listSchemas: vi.fn().mockResolvedValue(["public", "analytics"]),
    listTables: vi.fn().mockResolvedValue(["users", "orders"]),
    getColumns: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ChatDB", () => {
  let mockLLM: LLMProvider;
  let mockDB: DatabaseAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM = createMockLLM();
    mockDB = createMockDB();
    vi.mocked(resolveLLMProvider).mockResolvedValue(mockLLM);
    vi.mocked(resolveDatabaseAdapter).mockResolvedValue(mockDB);
  });

  // === Construction ===

  it("creates instance with required config", () => {
    const db = new ChatDB({ database: "postgresql://localhost/test", llm: { url: "http://localhost:1234" } });
    expect(db).toBeDefined();
  });

  // === query() ===

  it("query returns structured result", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    const result = await db.query("how many users?");

    expect(result.sql).toContain("SELECT COUNT(*)");
    expect(result.explanation).toBe("Count all users");
    expect(result.chartType).toBe("number");
    expect(result.columns).toEqual(["count"]);
    expect(result.rows).toEqual([{ count: 42 }]);
    expect(result.rowCount).toBe(1);
  });

  it("query adds LIMIT when missing", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    const result = await db.query("how many users?");

    // The LLM returned SQL without LIMIT, ensureLimit should add it
    expect(result.sql).toContain("LIMIT 1000");
  });

  it("query uses custom maxRows", async () => {
    const db = new ChatDB({
      database: "pg://localhost/test",
      llm: { url: "http://localhost:1234" },
      maxRows: 50,
    });
    const result = await db.query("how many users?");
    expect(result.sql).toContain("LIMIT 50");
  });

  it("query calls db.execute with correct SQL", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    await db.query("how many users?");

    expect(mockDB.execute).toHaveBeenCalledWith(
      expect.stringContaining("SELECT COUNT(*)"),
      "public",
    );
  });

  it("query passes schema to db.execute", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    await db.query("how many users?", { schema: "analytics" });

    expect(mockDB.execute).toHaveBeenCalledWith(
      expect.any(String),
      "analytics",
    );
  });

  it("query includes debug info when debug=true", async () => {
    const db = new ChatDB({
      database: "pg://localhost/test",
      llm: { url: "http://localhost:1234" },
      debug: true,
    });
    const result = await db.query("how many users?");

    expect(result.debug).toBeDefined();
    expect(result.debug!.model).toBe("test-model");
    expect(result.debug!.dialect).toBe("postgresql");
    expect(result.debug!.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.debug!.contextLength).toBe(4096);
  });

  it("query does NOT include debug info by default", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    const result = await db.query("how many users?");
    expect(result.debug).toBeUndefined();
  });

  it("query cleans up escaped chars in SQL", async () => {
    const llm = createMockLLM('{"sql":"SELECT * FROM users WHERE name = \\\\\\"John\\\\\\"","explanation":"find John","chartType":"table"}');
    vi.mocked(resolveLLMProvider).mockResolvedValue(llm);

    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    const result = await db.query("find John");
    // SQL should have been cleaned of escape chars
    expect(result.sql).not.toContain("\\\\");
  });

  it("query strips schema prefix from table names", async () => {
    const llm = createMockLLM('{"sql":"SELECT * FROM public.users","explanation":"all users","chartType":"table"}');
    vi.mocked(resolveLLMProvider).mockResolvedValue(llm);

    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    const result = await db.query("all users");
    expect(result.sql).not.toContain("public.");
    expect(result.sql).toContain("users");
  });

  it("query throws ValidationError for blocked SQL", async () => {
    const llm = createMockLLM('{"sql":"DELETE FROM users","explanation":"delete all","chartType":"table"}');
    vi.mocked(resolveLLMProvider).mockResolvedValue(llm);

    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    await expect(db.query("delete everyone")).rejects.toThrow(ValidationError);
  });

  it("query allows writes when allowWrites=true", async () => {
    const llm = createMockLLM('{"sql":"DELETE FROM users","explanation":"deleted","chartType":"table"}');
    vi.mocked(resolveLLMProvider).mockResolvedValue(llm);

    const db = new ChatDB({
      database: "pg://localhost/test",
      llm: { url: "http://localhost:1234" },
      allowWrites: true,
    });

    // Should not throw, but will still execute — the mock DB will return its default
    const result = await db.query("delete everyone");
    expect(result).toBeDefined();
  });

  it("query throws on invalid JSON from LLM", async () => {
    const llm = createMockLLM("not json");
    vi.mocked(resolveLLMProvider).mockResolvedValue(llm);

    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    await expect(db.query("test")).rejects.toThrow(ChatDBError);
    await expect(db.query("test")).rejects.toThrow("Failed to parse");
  });

  it("query throws on missing sql in LLM response", async () => {
    const llm = createMockLLM('{"explanation":"no sql","chartType":"table"}');
    vi.mocked(resolveLLMProvider).mockResolvedValue(llm);

    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    await expect(db.query("test")).rejects.toThrow("missing sql or explanation");
  });

  // === ask() (stateful conversation) ===

  it("ask builds history across calls", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });

    await db.ask("first question");
    await db.ask("second question");

    // The second call should include history
    const generateCalls = vi.mocked(mockLLM.generate).mock.calls;
    const secondCallMessages = generateCalls[1][0].messages;
    // Should have system + history(user, assistant) + user = at least 4 messages
    expect(secondCallMessages.length).toBeGreaterThanOrEqual(4);
  });

  it("ask returns same structure as query", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    const result = await db.ask("how many users?");

    expect(result.sql).toBeDefined();
    expect(result.explanation).toBeDefined();
    expect(result.chartType).toBeDefined();
    expect(result.columns).toBeDefined();
    expect(result.rows).toBeDefined();
    expect(result.rowCount).toBeDefined();
  });

  // === clearHistory() ===

  it("clearHistory resets conversation state", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });

    await db.ask("first question");
    db.clearHistory();
    await db.ask("after clear");

    // After clear, the second call should only have system + user (no history)
    const generateCalls = vi.mocked(mockLLM.generate).mock.calls;
    const afterClearMessages = generateCalls[1][0].messages;
    expect(afterClearMessages.length).toBe(2); // system + user
  });

  // === listSchemas / listTables / getSchema ===

  it("listSchemas delegates to adapter", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    const schemas = await db.listSchemas();
    expect(schemas).toEqual(["public", "analytics"]);
    expect(mockDB.listSchemas).toHaveBeenCalled();
  });

  it("listTables delegates to adapter", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    const tables = await db.listTables();
    expect(tables).toEqual(["users", "orders"]);
  });

  it("listTables passes schema name", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    await db.listTables("analytics");
    expect(mockDB.listTables).toHaveBeenCalledWith("analytics");
  });

  it("getSchema delegates to adapter", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    const schema = await db.getSchema();
    expect(schema).toContain("users");
    expect(mockDB.getSchemaText).toHaveBeenCalledWith("public");
  });

  // === refreshSchema ===

  it("refreshSchema clears internal cache", async () => {
    const db = new ChatDB({
      database: "pg://localhost/test",
      llm: { url: "http://localhost:1234" },
    });

    // First query caches the schema
    await db.query("how many users?");
    const firstCallCount = vi.mocked(mockDB.getSchemaText).mock.calls.length;

    // Second query should use cache
    await db.query("how many orders?");
    expect(vi.mocked(mockDB.getSchemaText).mock.calls.length).toBe(firstCallCount);

    // After refresh, next query should fetch fresh schema
    db.refreshSchema();
    await db.query("how many products?");
    expect(vi.mocked(mockDB.getSchemaText).mock.calls.length).toBe(firstCallCount + 1);
  });

  // === close() ===

  it("close calls adapter close", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    await db.query("trigger init");
    await db.close();
    expect(mockDB.close).toHaveBeenCalled();
  });

  it("close is safe to call before init", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    await db.close(); // Should not throw
    expect(mockDB.close).not.toHaveBeenCalled();
  });

  // === Lazy initialization ===

  it("initializes lazily on first query", async () => {
    new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    // Registry functions should NOT be called yet
    expect(resolveLLMProvider).not.toHaveBeenCalled();
    expect(resolveDatabaseAdapter).not.toHaveBeenCalled();
  });

  it("initializes on first query call", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    await db.query("trigger init");
    expect(resolveLLMProvider).toHaveBeenCalled();
    expect(resolveDatabaseAdapter).toHaveBeenCalled();
  });

  it("initializes only once across multiple queries", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    await db.query("first");
    await db.query("second");
    expect(resolveLLMProvider).toHaveBeenCalledTimes(1);
    expect(resolveDatabaseAdapter).toHaveBeenCalledTimes(1);
  });

  // === Schema caching ===

  it("caches schema across queries within TTL", async () => {
    const db = new ChatDB({
      database: "pg://localhost/test",
      llm: { url: "http://localhost:1234" },
      schemaCacheTTL: 60_000,
    });

    await db.query("first");
    await db.query("second");

    // getSchemaText should only be called once (from first query, then cached)
    // Note: getSchemaText is called during init AND during getCachedSchema
    // getCachedSchema calls db.getSchemaText only if cache is empty/expired
    const calls = vi.mocked(mockDB.getSchemaText).mock.calls;
    expect(calls.length).toBe(1);
  });

  // === Config defaults ===

  it("uses default config values", async () => {
    const db = new ChatDB({ database: "pg://localhost/test", llm: { url: "http://localhost:1234" } });
    const result = await db.query("test");
    // Default LIMIT is 1000
    expect(result.sql).toContain("LIMIT 1000");
  });

  it("uses custom schema from config", async () => {
    const db = new ChatDB({
      database: "pg://localhost/test",
      llm: { url: "http://localhost:1234" },
      schema: "analytics",
    });
    await db.query("test");
    expect(mockDB.execute).toHaveBeenCalledWith(expect.any(String), "analytics");
  });
});
