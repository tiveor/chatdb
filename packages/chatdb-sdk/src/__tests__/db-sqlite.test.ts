import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatabaseError } from "../utils/errors.js";

const mockStmt = {
  all: vi.fn(),
  columns: vi.fn(),
};
const mockDb = {
  prepare: vi.fn().mockReturnValue(mockStmt),
  pragma: vi.fn(),
  close: vi.fn(),
};
const MockDatabase = vi.fn().mockImplementation(() => mockDb);

vi.mock("better-sqlite3", () => ({ default: MockDatabase }));

const { SQLiteAdapter } = await import("../db/sqlite.js");

describe("SQLiteAdapter", () => {
  let adapter: InstanceType<typeof SQLiteAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare.mockReturnValue(mockStmt);
    MockDatabase.mockImplementation(() => mockDb);
    adapter = new SQLiteAdapter("./test.db");
  });

  it("has correct dialect and default schema", () => {
    expect(adapter.dialect).toBe("sqlite");
    expect(adapter.defaultSchema).toBe("main");
  });

  // === execute ===

  it("execute runs query and returns results", async () => {
    mockStmt.all.mockReturnValue([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);

    const result = await adapter.execute("SELECT * FROM users");
    expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM users");
    expect(result.columns).toEqual(["id", "name"]);
    expect(result.rows).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
    expect(result.rowCount).toBe(2);
  });

  it("execute handles empty results with columns fallback", async () => {
    mockStmt.all.mockReturnValue([]);
    mockStmt.columns.mockReturnValue([{ name: "id" }, { name: "name" }]);

    const result = await adapter.execute("SELECT * FROM empty_table");
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
    expect(result.columns).toEqual(["id", "name"]);
  });

  it("execute wraps errors in DatabaseError", async () => {
    mockStmt.all.mockImplementation(() => {
      throw new Error("no such table: nonexistent");
    });

    await expect(adapter.execute("SELECT * FROM nonexistent")).rejects.toThrow(DatabaseError);
    await expect(adapter.execute("SELECT * FROM nonexistent")).rejects.toThrow("no such table");
  });

  it("execute opens db in readonly mode", async () => {
    mockStmt.all.mockReturnValue([]);
    mockStmt.columns.mockReturnValue([]);

    await adapter.execute("SELECT 1");
    expect(MockDatabase).toHaveBeenCalledWith("./test.db", { readonly: true });
  });

  it("execute sets WAL journal mode", async () => {
    mockStmt.all.mockReturnValue([]);
    mockStmt.columns.mockReturnValue([]);

    await adapter.execute("SELECT 1");
    expect(mockDb.pragma).toHaveBeenCalledWith("journal_mode = WAL");
  });

  // === rawQuery ===

  it("rawQuery executes with params", async () => {
    mockStmt.all.mockReturnValue([{ count: 5 }]);

    const rows = await adapter.rawQuery("SELECT COUNT(*) FROM users WHERE id = ?", [1]);
    expect(rows).toEqual([{ count: 5 }]);
    expect(mockStmt.all).toHaveBeenCalledWith(1);
  });

  it("rawQuery executes without params", async () => {
    mockStmt.all.mockReturnValue([{ n: 1 }]);

    const rows = await adapter.rawQuery("SELECT 1 AS n");
    expect(rows).toEqual([{ n: 1 }]);
    expect(mockStmt.all).toHaveBeenCalledWith();
  });

  // === listSchemas ===

  it("listSchemas always returns ['main']", async () => {
    const schemas = await adapter.listSchemas();
    expect(schemas).toEqual(["main"]);
  });

  // === listTables ===

  it("listTables returns non-system tables", async () => {
    mockStmt.all.mockReturnValue([{ name: "users" }, { name: "orders" }]);

    const tables = await adapter.listTables();
    expect(tables).toEqual(["users", "orders"]);
  });

  // === getColumns ===

  it("getColumns queries PRAGMA table_info for each table", async () => {
    mockStmt.all
      .mockReturnValueOnce([{ name: "users" }]) // listTables
      .mockReturnValueOnce([
        { name: "id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
      ]); // PRAGMA table_info

    const cols = await adapter.getColumns();
    expect(cols).toEqual([
      { tableName: "users", columnName: "id", dataType: "INTEGER" },
      { tableName: "users", columnName: "name", dataType: "TEXT" },
    ]);
  });

  it("getColumns defaults empty type to TEXT", async () => {
    mockStmt.all
      .mockReturnValueOnce([{ name: "t" }])
      .mockReturnValueOnce([{ name: "col", type: "" }]);

    const cols = await adapter.getColumns();
    expect(cols[0].dataType).toBe("TEXT");
  });

  // === close ===

  it("close closes the database", async () => {
    mockStmt.all.mockReturnValue([]);
    mockStmt.columns.mockReturnValue([]);
    await adapter.execute("SELECT 1");

    await adapter.close();
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("close is safe when db not opened", async () => {
    const fresh = new SQLiteAdapter("./fresh.db");
    await fresh.close(); // Should not throw
  });

  // === getSchemaText (inherited) ===

  it("getSchemaText returns compact format", async () => {
    mockStmt.all
      .mockReturnValueOnce([{ name: "users" }]) // listTables
      .mockReturnValueOnce([
        { name: "id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
      ]); // PRAGMA table_info

    const text = await adapter.getSchemaText();
    expect(text).toBe("users(id INTEGER, name TEXT)");
  });
});
