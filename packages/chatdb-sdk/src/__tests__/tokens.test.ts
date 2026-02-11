import { describe, it, expect } from "vitest";
import { estimateTokens, truncateSchema } from "../utils/tokens.js";

describe("estimateTokens", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });

  it("rounds up partial tokens", () => {
    expect(estimateTokens("ab")).toBe(1); // 2 / 4 = 0.5 → ceil → 1
    expect(estimateTokens("abcde")).toBe(2); // 5 / 4 = 1.25 → ceil → 2
  });

  it("handles empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("handles single char", () => {
    expect(estimateTokens("x")).toBe(1);
  });

  it("estimates longer text", () => {
    const text = "a".repeat(400);
    expect(estimateTokens(text)).toBe(100);
  });

  it("estimates typical SQL schema", () => {
    const schema = "users(id bigint, name varchar, email varchar)\norders(id bigint, total numeric)";
    const tokens = estimateTokens(schema);
    expect(tokens).toBe(Math.ceil(schema.length / 4));
  });
});

describe("truncateSchema", () => {
  it("returns full schema when it fits", () => {
    const schema = "users(id bigint, name varchar)";
    const result = truncateSchema(schema, 100);
    expect(result.text).toBe(schema);
    expect(result.truncated).toBe(false);
  });

  it("truncates schema that exceeds budget", () => {
    const schema = "users(id bigint, name varchar)\norders(id bigint, total numeric)\nproducts(id bigint, price numeric)";
    // 1 token = 4 chars, so maxTokens = 10 means 40 chars max
    const result = truncateSchema(schema, 10);
    expect(result.truncated).toBe(true);
    expect(result.text).toContain("... (schema truncated to fit context)");
    expect(result.text.length).toBeLessThan(schema.length);
  });

  it("truncates at line boundary", () => {
    const schema = "users(id bigint)\norders(id bigint)\nproducts(id bigint)";
    // Give enough budget for first line + some of second
    const budget = Math.ceil(("users(id bigint)\norders".length) / 4);
    const result = truncateSchema(schema, budget);
    expect(result.truncated).toBe(true);
    // Should cut at the newline after "users(id bigint)"
    expect(result.text).toContain("users(id bigint)");
    expect(result.text).toContain("... (schema truncated to fit context)");
  });

  it("handles empty schema", () => {
    const result = truncateSchema("", 100);
    expect(result.text).toBe("");
    expect(result.truncated).toBe(false);
  });

  it("handles exact fit", () => {
    const schema = "abcd"; // 4 chars = 1 token
    const result = truncateSchema(schema, 1);
    expect(result.text).toBe(schema);
    expect(result.truncated).toBe(false);
  });

  it("handles schema just over budget", () => {
    const schema = "abcde"; // 5 chars, but budget is 1 token (4 chars)
    const result = truncateSchema(schema, 1);
    expect(result.truncated).toBe(true);
  });
});
