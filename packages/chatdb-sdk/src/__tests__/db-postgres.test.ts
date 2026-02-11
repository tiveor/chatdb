import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DatabaseError } from "../utils/errors.js";

// Mock the pg module
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};
const mockPool = {
  connect: vi.fn().mockResolvedValue(mockClient),
  query: vi.fn(),
  end: vi.fn(),
};

vi.mock("pg", () => ({
  default: {
    Pool: vi.fn().mockImplementation(() => mockPool),
  },
}));

const { PostgresAdapter } = await import("../db/postgres.js");

describe("PostgresAdapter", () => {
  let adapter: InstanceType<typeof PostgresAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    adapter = new PostgresAdapter("postgresql://localhost/test", 5, 10_000);
  });

  it("has correct dialect and default schema", () => {
    expect(adapter.dialect).toBe("postgresql");
    expect(adapter.defaultSchema).toBe("public");
  });

  // === execute ===

  it("execute sets search_path and runs query", async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined) // SET search_path
      .mockResolvedValueOnce({
        fields: [{ name: "id" }, { name: "name" }],
        rows: [{ id: 1, name: "Alice" }],
        rowCount: 1,
      });

    const result = await adapter.execute("SELECT * FROM users", "public");
    expect(mockClient.query).toHaveBeenCalledWith('SET search_path TO "public", public');
    expect(result.columns).toEqual(["id", "name"]);
    expect(result.rows).toEqual([{ id: 1, name: "Alice" }]);
    expect(result.rowCount).toBe(1);
  });

  it("execute releases client on success", async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ fields: [], rows: [], rowCount: 0 });

    await adapter.execute("SELECT 1");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("execute releases client on error", async () => {
    mockClient.query.mockRejectedValueOnce(new Error("timeout"));

    await expect(adapter.execute("SELECT 1")).rejects.toThrow(DatabaseError);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("execute wraps errors in DatabaseError", async () => {
    mockClient.query
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockRejectedValueOnce(new Error("connection refused"));

    await expect(adapter.execute("SELECT 1")).rejects.toThrow(DatabaseError);
    await expect(adapter.execute("SELECT 1")).rejects.toThrow("connection refused");
  });

  it("execute sanitizes schema name", async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ fields: [], rows: [], rowCount: 0 });

    await adapter.execute("SELECT 1", "my; DROP TABLE--schema");
    expect(mockClient.query).toHaveBeenCalledWith('SET search_path TO "myDROPTABLE--schema", public');
  });

  it("execute defaults schema to public", async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ fields: [], rows: [], rowCount: 0 });

    await adapter.execute("SELECT 1");
    expect(mockClient.query).toHaveBeenCalledWith('SET search_path TO "public", public');
  });

  it("execute handles null rowCount", async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ fields: [], rows: [], rowCount: null });

    const result = await adapter.execute("SELECT 1");
    expect(result.rowCount).toBe(0);
  });

  // === rawQuery ===

  it("rawQuery executes parameterized query", async () => {
    mockPool.query.mockResolvedValue({ rows: [{ count: 42 }] });

    const rows = await adapter.rawQuery("SELECT COUNT(*) FROM users WHERE id = $1", [1]);
    expect(rows).toEqual([{ count: 42 }]);
    expect(mockPool.query).toHaveBeenCalledWith("SELECT COUNT(*) FROM users WHERE id = $1", [1]);
  });

  it("rawQuery works without params", async () => {
    mockPool.query.mockResolvedValue({ rows: [{ n: 1 }] });

    const rows = await adapter.rawQuery("SELECT 1 AS n");
    expect(rows).toEqual([{ n: 1 }]);
  });

  // === getColumns ===

  it("getColumns returns structured column info", async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { table_name: "users", column_name: "id", data_type: "bigint" },
        { table_name: "users", column_name: "name", data_type: "varchar" },
      ],
    });

    const cols = await adapter.getColumns("public");
    expect(cols).toEqual([
      { tableName: "users", columnName: "id", dataType: "bigint" },
      { tableName: "users", columnName: "name", dataType: "varchar" },
    ]);
  });

  it("getColumns defaults to public schema", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await adapter.getColumns();
    expect(mockPool.query.mock.calls[0][1]).toEqual(["public"]);
  });

  // === listSchemas ===

  it("listSchemas returns schema names", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ schema_name: "public" }, { schema_name: "analytics" }],
    });

    const schemas = await adapter.listSchemas();
    expect(schemas).toEqual(["public", "analytics"]);
  });

  // === listTables ===

  it("listTables returns table names", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ table_name: "users" }, { table_name: "orders" }],
    });

    const tables = await adapter.listTables("public");
    expect(tables).toEqual(["users", "orders"]);
  });

  it("listTables defaults to public schema", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await adapter.listTables();
    expect(mockPool.query.mock.calls[0][1]).toEqual(["public"]);
  });

  // === close ===

  it("close ends the pool", async () => {
    // Trigger pool creation by executing a query
    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ fields: [], rows: [], rowCount: 0 });
    await adapter.execute("SELECT 1");

    await adapter.close();
    expect(mockPool.end).toHaveBeenCalled();
  });

  it("close is safe to call when pool not created", async () => {
    const fresh = new PostgresAdapter("pg://localhost/test");
    await fresh.close(); // Should not throw
  });

  // === getSchemaText (inherited from base) ===

  it("getSchemaText returns compact format", async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { table_name: "users", column_name: "id", data_type: "bigint" },
        { table_name: "users", column_name: "name", data_type: "varchar" },
        { table_name: "orders", column_name: "id", data_type: "bigint" },
      ],
    });

    const text = await adapter.getSchemaText("public");
    expect(text).toBe("users(id bigint, name varchar)\norders(id bigint)");
  });
});
