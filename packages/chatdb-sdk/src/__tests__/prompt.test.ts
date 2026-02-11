import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../prompt/system.js";
import { DIALECTS } from "../prompt/dialects.js";

describe("DIALECTS", () => {
  it("has all three dialects defined", () => {
    expect(DIALECTS).toHaveProperty("postgresql");
    expect(DIALECTS).toHaveProperty("mysql");
    expect(DIALECTS).toHaveProperty("sqlite");
  });

  it("postgresql dialect has correct properties", () => {
    const pg = DIALECTS.postgresql;
    expect(pg.name).toBe("PostgreSQL");
    expect(pg.currentDate).toBe("CURRENT_DATE");
    expect(pg.stringConcat).toBe("||");
    expect(pg.notes.length).toBeGreaterThan(0);
  });

  it("mysql dialect has correct properties", () => {
    const mysql = DIALECTS.mysql;
    expect(mysql.name).toBe("MySQL");
    expect(mysql.currentDate).toBe("CURDATE()");
    expect(mysql.stringConcat).toBe("CONCAT(a, b)");
    expect(mysql.notes.length).toBeGreaterThan(0);
  });

  it("sqlite dialect has correct properties", () => {
    const sqlite = DIALECTS.sqlite;
    expect(sqlite.name).toBe("SQLite");
    expect(sqlite.currentDate).toBe("date('now')");
    expect(sqlite.stringConcat).toBe("||");
    expect(sqlite.notes.length).toBeGreaterThan(0);
  });
});

describe("buildSystemPrompt", () => {
  const schema = "users(id bigint, name varchar)\norders(id bigint, total numeric)";

  it("includes dialect name for PostgreSQL", () => {
    const prompt = buildSystemPrompt("postgresql", schema, "public");
    expect(prompt).toContain("PostgreSQL");
    expect(prompt).toContain("SQL assistant");
  });

  it("includes dialect name for MySQL", () => {
    const prompt = buildSystemPrompt("mysql", schema, "mydb");
    expect(prompt).toContain("MySQL");
  });

  it("includes dialect name for SQLite", () => {
    const prompt = buildSystemPrompt("sqlite", schema, "main");
    expect(prompt).toContain("SQLite");
  });

  it("includes schema name", () => {
    const prompt = buildSystemPrompt("postgresql", schema, "analytics");
    expect(prompt).toContain('"analytics"');
  });

  it("includes schema text", () => {
    const prompt = buildSystemPrompt("postgresql", schema, "public");
    expect(prompt).toContain("users(id bigint, name varchar)");
    expect(prompt).toContain("orders(id bigint, total numeric)");
  });

  it("includes SCHEMA: section", () => {
    const prompt = buildSystemPrompt("postgresql", schema, "public");
    expect(prompt).toContain("SCHEMA:\n");
  });

  it("includes JSON format instructions", () => {
    const prompt = buildSystemPrompt("postgresql", schema, "public");
    expect(prompt).toContain("sql");
    expect(prompt).toContain("explanation");
    expect(prompt).toContain("chartType");
    expect(prompt).toContain("bar|line|pie|table|number");
  });

  it("includes SELECT-only rule", () => {
    const prompt = buildSystemPrompt("postgresql", schema, "public");
    expect(prompt).toContain("ONLY SELECT");
    expect(prompt).toContain("LIMIT 1000");
  });

  it("includes same-language instruction", () => {
    const prompt = buildSystemPrompt("mysql", schema, "mydb");
    expect(prompt).toContain("SAME LANGUAGE");
  });

  it("includes dialect-specific notes for PostgreSQL", () => {
    const prompt = buildSystemPrompt("postgresql", schema, "public");
    expect(prompt).toContain("ILIKE");
    expect(prompt).toContain("CURRENT_DATE");
    expect(prompt).toContain("||");
  });

  it("includes dialect-specific notes for MySQL", () => {
    const prompt = buildSystemPrompt("mysql", schema, "mydb");
    expect(prompt).toContain("backticks");
    expect(prompt).toContain("CURDATE()");
    expect(prompt).toContain("CONCAT(a, b)");
  });

  it("includes dialect-specific notes for SQLite", () => {
    const prompt = buildSystemPrompt("sqlite", schema, "main");
    expect(prompt).toContain("strftime");
    expect(prompt).toContain("date('now')");
    expect(prompt).toContain("No RIGHT JOIN");
  });

  it("includes PG-specific table_schema warning only for postgresql", () => {
    const pg = buildSystemPrompt("postgresql", schema, "public");
    expect(pg).toContain("table_schema");

    const mysql = buildSystemPrompt("mysql", schema, "mydb");
    expect(mysql).not.toContain("table_schema");

    const sqlite = buildSystemPrompt("sqlite", schema, "main");
    expect(sqlite).not.toContain("table_schema");
  });

  it("includes GROUP BY aggregation rule", () => {
    const prompt = buildSystemPrompt("postgresql", schema, "public");
    expect(prompt).toContain("GROUP BY");
    expect(prompt).toContain("aggregate function");
  });

  it("handles empty schema text", () => {
    const prompt = buildSystemPrompt("postgresql", "", "public");
    expect(prompt).toContain("SCHEMA:\n");
    expect(prompt).toContain("PostgreSQL");
  });
});
