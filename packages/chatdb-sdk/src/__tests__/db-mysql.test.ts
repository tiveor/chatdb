import { describe, it, expect, vi, beforeEach } from "vitest";
import { DatabaseError } from "../utils/errors.js";

const mockPool = {
  query: vi.fn(),
  end: vi.fn(),
};

vi.mock("mysql2/promise", () => ({
  default: {
    createPool: vi.fn().mockImplementation(() => mockPool),
  },
}));

const { MySQLAdapter } = await import("../db/mysql.js");

describe("MySQLAdapter", () => {
  let adapter: InstanceType<typeof MySQLAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new MySQLAdapter("mysql://root:pass@localhost:3306/mydb", 5, 10_000);
  });

  it("has correct dialect", () => {
    expect(adapter.dialect).toBe("mysql");
  });

  it("extracts database name from connection string", () => {
    expect(adapter.defaultSchema).toBe("mydb");
  });

  it("extracts database name with query params", () => {
    const a = new MySQLAdapter("mysql://root@localhost/testdb?charset=utf8", 5, 10_000);
    expect(a.defaultSchema).toBe("testdb");
  });

  it("falls back to mysql if no database in URL", () => {
    const a = new MySQLAdapter("mysql://root@localhost", 5, 10_000);
    expect(a.defaultSchema).toBe("mysql");
  });

  // === execute ===

  it("execute runs USE and query", async () => {
    mockPool.query
      .mockResolvedValueOnce(undefined) // USE
      .mockResolvedValueOnce([
        [{ id: 1, name: "Alice" }],
        [{ name: "id" }, { name: "name" }],
      ]);

    const result = await adapter.execute("SELECT * FROM users", "mydb");
    expect(mockPool.query).toHaveBeenCalledWith("USE `mydb`");
    expect(result.columns).toEqual(["id", "name"]);
    expect(result.rows).toEqual([{ id: 1, name: "Alice" }]);
    expect(result.rowCount).toBe(1);
  });

  it("execute wraps errors in DatabaseError", async () => {
    mockPool.query
      .mockRejectedValueOnce(new Error("access denied"))
      .mockRejectedValueOnce(new Error("access denied"));

    await expect(adapter.execute("SELECT 1", "mydb")).rejects.toThrow(DatabaseError);
    await expect(adapter.execute("SELECT 1", "mydb")).rejects.toThrow("access denied");
  });

  it("execute without schema skips USE", async () => {
    mockPool.query.mockResolvedValueOnce([
      [{ n: 1 }],
      [{ name: "n" }],
    ]);

    await adapter.execute("SELECT 1 AS n");
    // Only one call (the SELECT), no USE
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  // === rawQuery ===

  it("rawQuery executes parameterized query", async () => {
    mockPool.query.mockResolvedValue([[{ count: 5 }]]);

    const rows = await adapter.rawQuery("SELECT COUNT(*) FROM users WHERE id = ?", [1]);
    expect(rows).toEqual([{ count: 5 }]);
  });

  // === getColumns ===

  it("getColumns returns structured column info", async () => {
    mockPool.query.mockResolvedValue([[
      { TABLE_NAME: "users", COLUMN_NAME: "id", DATA_TYPE: "bigint" },
      { TABLE_NAME: "users", COLUMN_NAME: "name", DATA_TYPE: "varchar" },
    ]]);

    const cols = await adapter.getColumns("mydb");
    expect(cols).toEqual([
      { tableName: "users", columnName: "id", dataType: "bigint" },
      { tableName: "users", columnName: "name", dataType: "varchar" },
    ]);
  });

  // === listSchemas ===

  it("listSchemas returns non-system databases", async () => {
    mockPool.query.mockResolvedValue([[
      { Database: "mydb" },
      { Database: "information_schema" },
      { Database: "mysql" },
      { Database: "other" },
    ]]);

    const schemas = await adapter.listSchemas();
    expect(schemas).toEqual(["mydb", "other"]);
  });

  // === listTables ===

  it("listTables returns table names", async () => {
    mockPool.query.mockResolvedValue([[
      { TABLE_NAME: "users" },
      { TABLE_NAME: "orders" },
    ]]);

    const tables = await adapter.listTables("mydb");
    expect(tables).toEqual(["users", "orders"]);
  });

  // === close ===

  it("close ends the pool", async () => {
    // Trigger pool creation
    mockPool.query.mockResolvedValue([[], []]);
    await adapter.execute("SELECT 1");

    await adapter.close();
    expect(mockPool.end).toHaveBeenCalled();
  });

  it("close is safe when pool not created", async () => {
    const fresh = new MySQLAdapter("mysql://localhost/test");
    await fresh.close(); // Should not throw
  });
});
