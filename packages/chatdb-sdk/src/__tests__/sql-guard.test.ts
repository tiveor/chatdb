import { describe, it, expect } from "vitest";
import { validateSQL, ensureLimit } from "../guard/sql-guard.js";

describe("validateSQL", () => {
  // === ALLOWED QUERIES ===

  it("allows simple SELECT", () => {
    expect(validateSQL("SELECT * FROM users")).toEqual({ valid: true });
  });

  it("allows SELECT with WHERE", () => {
    expect(validateSQL("SELECT id, name FROM users WHERE active = true")).toEqual({ valid: true });
  });

  it("allows SELECT with JOIN", () => {
    expect(validateSQL("SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id")).toEqual({ valid: true });
  });

  it("allows SELECT with aggregation and GROUP BY", () => {
    expect(validateSQL("SELECT status, COUNT(*) FROM orders GROUP BY status")).toEqual({ valid: true });
  });

  it("allows SELECT with subquery", () => {
    expect(validateSQL("SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)")).toEqual({ valid: true });
  });

  it("allows CTE (WITH ... AS)", () => {
    expect(validateSQL("WITH active AS (SELECT * FROM users WHERE active = true) SELECT * FROM active")).toEqual({ valid: true });
  });

  it("allows case-insensitive SELECT", () => {
    expect(validateSQL("select * from users")).toEqual({ valid: true });
    expect(validateSQL("Select * From Users")).toEqual({ valid: true });
  });

  it("allows case-insensitive WITH", () => {
    expect(validateSQL("with cte as (select 1) select * from cte")).toEqual({ valid: true });
  });

  it("allows trailing semicolon (single statement)", () => {
    expect(validateSQL("SELECT * FROM users;")).toEqual({ valid: true });
  });

  it("allows keywords inside string literals", () => {
    expect(validateSQL("SELECT * FROM users WHERE name = 'DELETE ME'")).toEqual({ valid: true });
  });

  it("allows keywords inside string literals with INSERT", () => {
    expect(validateSQL("SELECT * FROM users WHERE bio = 'I want to INSERT data'")).toEqual({ valid: true });
  });

  it("allows LIMIT clause", () => {
    expect(validateSQL("SELECT * FROM users LIMIT 10")).toEqual({ valid: true });
  });

  it("allows HAVING clause", () => {
    expect(validateSQL("SELECT status, COUNT(*) FROM orders GROUP BY status HAVING COUNT(*) > 5")).toEqual({ valid: true });
  });

  it("allows DISTINCT", () => {
    expect(validateSQL("SELECT DISTINCT name FROM users")).toEqual({ valid: true });
  });

  it("allows ORDER BY", () => {
    expect(validateSQL("SELECT * FROM users ORDER BY created_at DESC")).toEqual({ valid: true });
  });

  it("allows UNION", () => {
    expect(validateSQL("SELECT name FROM users UNION SELECT name FROM admins")).toEqual({ valid: true });
  });

  it("handles whitespace and trimming", () => {
    expect(validateSQL("  SELECT * FROM users  ")).toEqual({ valid: true });
  });

  // === BLOCKED QUERIES ===

  it("blocks INSERT", () => {
    const result = validateSQL("INSERT INTO users (name) VALUES ('test')");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only SELECT queries are allowed");
  });

  it("blocks UPDATE", () => {
    const result = validateSQL("UPDATE users SET name = 'test'");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only SELECT queries are allowed");
  });

  it("blocks DELETE", () => {
    const result = validateSQL("DELETE FROM users WHERE id = 1");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only SELECT queries are allowed");
  });

  it("blocks DROP TABLE", () => {
    const result = validateSQL("DROP TABLE users");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only SELECT queries are allowed");
  });

  it("blocks ALTER TABLE", () => {
    const result = validateSQL("ALTER TABLE users ADD COLUMN age INT");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only SELECT queries are allowed");
  });

  it("blocks TRUNCATE", () => {
    const result = validateSQL("TRUNCATE TABLE users");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only SELECT queries are allowed");
  });

  it("blocks CREATE", () => {
    const result = validateSQL("CREATE TABLE evil (id INT)");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only SELECT queries are allowed");
  });

  it("blocks GRANT", () => {
    const result = validateSQL("GRANT ALL ON users TO evil");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only SELECT queries are allowed");
  });

  it("blocks multiple statements (SQL injection)", () => {
    const result = validateSQL("SELECT * FROM users; DROP TABLE users;");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Multiple statements");
  });

  it("blocks SELECT with hidden DELETE in second statement", () => {
    const result = validateSQL("SELECT * FROM users; DELETE FROM users;");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Multiple statements");
  });

  it("blocks SELECT INTO (data exfiltration via keyword)", () => {
    // "COPY" is a blocked keyword
    const result = validateSQL("SELECT * FROM users WHERE COPY = 1");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("COPY");
  });

  it("blocks EXECUTE keyword inside SELECT", () => {
    const result = validateSQL("SELECT EXECUTE('something') FROM users");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("EXECUTE");
  });

  it("blocks empty input", () => {
    const result = validateSQL("");
    expect(result.valid).toBe(false);
  });

  it("blocks random text", () => {
    const result = validateSQL("hello world");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only SELECT queries are allowed");
  });

  // === allowWrites option ===

  it("allows INSERT when allowWrites is true", () => {
    expect(validateSQL("INSERT INTO users (name) VALUES ('test')", { allowWrites: true })).toEqual({
      valid: true,
    });
  });

  it("allows DELETE when allowWrites is true", () => {
    expect(validateSQL("DELETE FROM users", { allowWrites: true })).toEqual({ valid: true });
  });

  it("allows DROP when allowWrites is true", () => {
    expect(validateSQL("DROP TABLE users", { allowWrites: true })).toEqual({ valid: true });
  });

  it("blocks by default when allowWrites is not specified", () => {
    expect(validateSQL("DELETE FROM users").valid).toBe(false);
  });

  it("blocks when allowWrites is explicitly false", () => {
    expect(validateSQL("DELETE FROM users", { allowWrites: false }).valid).toBe(false);
  });
});

describe("ensureLimit", () => {
  it("adds LIMIT when missing", () => {
    expect(ensureLimit("SELECT * FROM users")).toBe("SELECT * FROM users LIMIT 1000");
  });

  it("adds custom LIMIT when missing", () => {
    expect(ensureLimit("SELECT * FROM users", 500)).toBe("SELECT * FROM users LIMIT 500");
  });

  it("preserves existing LIMIT", () => {
    expect(ensureLimit("SELECT * FROM users LIMIT 10")).toBe("SELECT * FROM users LIMIT 10");
  });

  it("preserves existing LIMIT with different case", () => {
    expect(ensureLimit("SELECT * FROM users limit 50")).toBe("SELECT * FROM users limit 50");
  });

  it("strips trailing semicolon", () => {
    expect(ensureLimit("SELECT * FROM users;")).toBe("SELECT * FROM users LIMIT 1000");
  });

  it("strips trailing semicolon when LIMIT exists", () => {
    expect(ensureLimit("SELECT * FROM users LIMIT 10;")).toBe("SELECT * FROM users LIMIT 10");
  });

  it("trims whitespace", () => {
    expect(ensureLimit("  SELECT * FROM users  ")).toBe("SELECT * FROM users LIMIT 1000");
  });

  it("handles complex queries", () => {
    const sql = "SELECT u.name, COUNT(*) FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.name ORDER BY COUNT(*) DESC";
    expect(ensureLimit(sql)).toBe(sql + " LIMIT 1000");
  });

  it("does not double-add LIMIT", () => {
    const sql = "SELECT * FROM users LIMIT 1000";
    expect(ensureLimit(sql)).toBe(sql);
  });

  it("uses default maxRows of 1000", () => {
    expect(ensureLimit("SELECT 1")).toBe("SELECT 1 LIMIT 1000");
  });
});
