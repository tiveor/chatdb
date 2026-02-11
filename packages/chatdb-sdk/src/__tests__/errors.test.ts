import { describe, it, expect } from "vitest";
import {
  ChatDBError,
  ValidationError,
  LLMError,
  DatabaseError,
  ContextOverflowError,
} from "../utils/errors.js";

describe("ChatDBError", () => {
  it("creates error with message and default code", () => {
    const err = new ChatDBError("something went wrong");
    expect(err.message).toBe("something went wrong");
    expect(err.code).toBe("CHATDB_ERROR");
    expect(err.name).toBe("ChatDBError");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ChatDBError);
  });

  it("creates error with custom code", () => {
    const err = new ChatDBError("test", "CUSTOM_CODE");
    expect(err.code).toBe("CUSTOM_CODE");
  });
});

describe("ValidationError", () => {
  it("creates error with message and SQL", () => {
    const err = new ValidationError("INSERT not allowed", "INSERT INTO users VALUES (1)");
    expect(err.message).toBe("INSERT not allowed");
    expect(err.sql).toBe("INSERT INTO users VALUES (1)");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.name).toBe("ValidationError");
    expect(err).toBeInstanceOf(ChatDBError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("LLMError", () => {
  it("creates error with provider info", () => {
    const err = new LLMError("API timeout", "openai", 504);
    expect(err.message).toBe("API timeout");
    expect(err.provider).toBe("openai");
    expect(err.statusCode).toBe(504);
    expect(err.code).toBe("LLM_ERROR");
    expect(err.name).toBe("LLMError");
    expect(err).toBeInstanceOf(ChatDBError);
  });

  it("works without status code", () => {
    const err = new LLMError("connection refused", "anthropic");
    expect(err.statusCode).toBeUndefined();
    expect(err.provider).toBe("anthropic");
  });
});

describe("DatabaseError", () => {
  it("creates error with dialect info", () => {
    const err = new DatabaseError("connection refused", "postgresql");
    expect(err.message).toBe("connection refused");
    expect(err.dialect).toBe("postgresql");
    expect(err.code).toBe("DATABASE_ERROR");
    expect(err.name).toBe("DatabaseError");
    expect(err).toBeInstanceOf(ChatDBError);
  });
});

describe("ContextOverflowError", () => {
  it("creates with predefined message", () => {
    const err = new ContextOverflowError("openai");
    expect(err.message).toContain("context window");
    expect(err.message).toContain("clearHistory");
    expect(err.code).toBe("CONTEXT_OVERFLOW");
    expect(err.name).toBe("ContextOverflowError");
    expect(err.provider).toBe("openai");
    expect(err).toBeInstanceOf(LLMError);
    expect(err).toBeInstanceOf(ChatDBError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("Error hierarchy", () => {
  it("all errors extend Error", () => {
    expect(new ChatDBError("")).toBeInstanceOf(Error);
    expect(new ValidationError("", "")).toBeInstanceOf(Error);
    expect(new LLMError("", "")).toBeInstanceOf(Error);
    expect(new DatabaseError("", "")).toBeInstanceOf(Error);
    expect(new ContextOverflowError("")).toBeInstanceOf(Error);
  });

  it("all errors extend ChatDBError", () => {
    expect(new ValidationError("", "")).toBeInstanceOf(ChatDBError);
    expect(new LLMError("", "")).toBeInstanceOf(ChatDBError);
    expect(new DatabaseError("", "")).toBeInstanceOf(ChatDBError);
    expect(new ContextOverflowError("")).toBeInstanceOf(ChatDBError);
  });

  it("ContextOverflowError extends LLMError", () => {
    expect(new ContextOverflowError("")).toBeInstanceOf(LLMError);
  });

  it("can be caught by type in try/catch", () => {
    try {
      throw new ValidationError("bad sql", "DROP TABLE");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err).toBeInstanceOf(ChatDBError);
      if (err instanceof ValidationError) {
        expect(err.sql).toBe("DROP TABLE");
      }
    }
  });
});
