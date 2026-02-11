import { describe, it, expect, vi } from "vitest";
import { ChatDBError } from "../utils/errors.js";

// We test the registry by mocking the adapter imports
vi.mock("../db/postgres.js", () => ({
  PostgresAdapter: class MockPostgres {
    dialect = "postgresql";
    defaultSchema = "public";
    constructor(public url: string, public poolSize: number, public timeout: number) {}
  },
}));
vi.mock("../db/mysql.js", () => ({
  MySQLAdapter: class MockMySQL {
    dialect = "mysql";
    defaultSchema = "mydb";
    constructor(public url: string, public poolSize: number, public timeout: number) {}
  },
}));
vi.mock("../db/sqlite.js", () => ({
  SQLiteAdapter: class MockSQLite {
    dialect = "sqlite";
    defaultSchema = "main";
    constructor(public filePath: string) {}
  },
}));

// Import after mocks
const { resolveDatabaseAdapter } = await import("../db/registry.js");

describe("resolveDatabaseAdapter", () => {
  // === Auto-detection from string ===

  it("detects PostgreSQL from postgresql:// prefix", async () => {
    const adapter: any = await resolveDatabaseAdapter("postgresql://localhost/mydb");
    expect(adapter.dialect).toBe("postgresql");
    expect(adapter.url).toBe("postgresql://localhost/mydb");
  });

  it("detects PostgreSQL from postgres:// prefix", async () => {
    const adapter: any = await resolveDatabaseAdapter("postgres://localhost/mydb");
    expect(adapter.dialect).toBe("postgresql");
  });

  it("detects MySQL from mysql:// prefix", async () => {
    const adapter: any = await resolveDatabaseAdapter("mysql://localhost/mydb");
    expect(adapter.dialect).toBe("mysql");
  });

  it("detects SQLite from .sqlite extension", async () => {
    const adapter: any = await resolveDatabaseAdapter("data.sqlite");
    // detectDialect throws for "data.sqlite" since it doesn't match any prefix
    // Actually let me check — .sqlite ending matches
    expect(adapter.dialect).toBe("sqlite");
  });

  it("detects SQLite from .sqlite3 extension", async () => {
    const adapter: any = await resolveDatabaseAdapter("data.sqlite3");
    expect(adapter.dialect).toBe("sqlite");
  });

  it("detects SQLite from .db extension", async () => {
    const adapter: any = await resolveDatabaseAdapter("my-database.db");
    expect(adapter.dialect).toBe("sqlite");
  });

  it("detects SQLite from sqlite:// prefix", async () => {
    const adapter: any = await resolveDatabaseAdapter("sqlite:///path/to/db.sqlite");
    expect(adapter.dialect).toBe("sqlite");
    expect(adapter.filePath).toBe("/path/to/db.sqlite");
  });

  it("detects SQLite from ./ prefix (relative path)", async () => {
    const adapter: any = await resolveDatabaseAdapter("./data/test.db");
    expect(adapter.dialect).toBe("sqlite");
  });

  it("detects SQLite from / prefix (absolute path)", async () => {
    const adapter: any = await resolveDatabaseAdapter("/tmp/test.db");
    expect(adapter.dialect).toBe("sqlite");
  });

  it("strips sqlite:// prefix for SQLite file path", async () => {
    const adapter: any = await resolveDatabaseAdapter("sqlite://mydata.db");
    expect(adapter.filePath).toBe("mydata.db");
  });

  it("throws for unrecognized URL", async () => {
    await expect(resolveDatabaseAdapter("ftp://something")).rejects.toThrow(ChatDBError);
    await expect(resolveDatabaseAdapter("ftp://something")).rejects.toThrow("Cannot detect database dialect");
  });

  // === Config object ===

  it("uses explicit dialect from config object", async () => {
    const adapter: any = await resolveDatabaseAdapter({
      url: "some-custom-string",
      dialect: "postgresql",
    });
    expect(adapter.dialect).toBe("postgresql");
  });

  it("uses poolSize from config object", async () => {
    const adapter: any = await resolveDatabaseAdapter({
      url: "postgresql://localhost/mydb",
      poolSize: 10,
    });
    expect(adapter.poolSize).toBe(10);
  });

  it("uses default poolSize when not specified", async () => {
    const adapter: any = await resolveDatabaseAdapter("postgresql://localhost/mydb");
    expect(adapter.poolSize).toBe(5);
  });

  it("passes timeout parameter", async () => {
    const adapter: any = await resolveDatabaseAdapter("postgresql://localhost/mydb", 5000);
    expect(adapter.timeout).toBe(5000);
  });

  it("uses default timeout of 10000", async () => {
    const adapter: any = await resolveDatabaseAdapter("postgresql://localhost/mydb");
    expect(adapter.timeout).toBe(10_000);
  });
});
