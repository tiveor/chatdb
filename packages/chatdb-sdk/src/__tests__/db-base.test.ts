import { describe, it, expect } from "vitest";
import { BaseDatabaseAdapter } from "../db/base.js";
import type { DatabaseDialect } from "../types.js";
import type { QueryResultRaw, TableColumnInfo } from "../db/types.js";

// Concrete test implementation of the abstract class
class TestAdapter extends BaseDatabaseAdapter {
  readonly dialect: DatabaseDialect = "postgresql";
  readonly defaultSchema = "public";
  private mockColumns: TableColumnInfo[];

  constructor(columns: TableColumnInfo[]) {
    super();
    this.mockColumns = columns;
  }

  async execute(): Promise<QueryResultRaw> {
    return { columns: [], rows: [], rowCount: 0 };
  }
  async rawQuery(): Promise<any[]> {
    return [];
  }
  async getColumns(): Promise<TableColumnInfo[]> {
    return this.mockColumns;
  }
  async listSchemas(): Promise<string[]> {
    return ["public"];
  }
  async listTables(): Promise<string[]> {
    return [];
  }
  async close(): Promise<void> {}
}

describe("BaseDatabaseAdapter.getSchemaText", () => {
  it("formats single table correctly", async () => {
    const adapter = new TestAdapter([
      { tableName: "users", columnName: "id", dataType: "bigint" },
      { tableName: "users", columnName: "name", dataType: "varchar" },
      { tableName: "users", columnName: "email", dataType: "varchar" },
    ]);

    const text = await adapter.getSchemaText();
    expect(text).toBe("users(id bigint, name varchar, email varchar)");
  });

  it("formats multiple tables correctly", async () => {
    const adapter = new TestAdapter([
      { tableName: "users", columnName: "id", dataType: "bigint" },
      { tableName: "users", columnName: "name", dataType: "varchar" },
      { tableName: "orders", columnName: "id", dataType: "bigint" },
      { tableName: "orders", columnName: "total", dataType: "numeric" },
    ]);

    const text = await adapter.getSchemaText();
    expect(text).toBe("users(id bigint, name varchar)\norders(id bigint, total numeric)");
  });

  it("handles empty columns", async () => {
    const adapter = new TestAdapter([]);
    const text = await adapter.getSchemaText();
    expect(text).toBe("");
  });

  it("handles table with single column", async () => {
    const adapter = new TestAdapter([
      { tableName: "settings", columnName: "key", dataType: "text" },
    ]);

    const text = await adapter.getSchemaText();
    expect(text).toBe("settings(key text)");
  });

  it("preserves column order", async () => {
    const adapter = new TestAdapter([
      { tableName: "t", columnName: "c", dataType: "int" },
      { tableName: "t", columnName: "b", dataType: "text" },
      { tableName: "t", columnName: "a", dataType: "bool" },
    ]);

    const text = await adapter.getSchemaText();
    expect(text).toBe("t(c int, b text, a bool)");
  });

  it("handles many tables", async () => {
    const columns: TableColumnInfo[] = [];
    for (let i = 0; i < 10; i++) {
      columns.push({ tableName: `table_${i}`, columnName: "id", dataType: "int" });
    }

    const adapter = new TestAdapter(columns);
    const text = await adapter.getSchemaText();
    const lines = text.split("\n");
    expect(lines.length).toBe(10);
    expect(lines[0]).toBe("table_0(id int)");
    expect(lines[9]).toBe("table_9(id int)");
  });
});
