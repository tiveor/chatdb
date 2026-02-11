import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env and mock process.exit
const originalEnv = { ...process.env };
const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
  throw new Error("process.exit called");
}) as any);

beforeEach(() => {
  // Clear all CHATDB / DATABASE / LLM env vars
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("CHATDB_") ||
      key === "DATABASE_URL" ||
      key === "OPENAI_API_KEY" ||
      key === "ANTHROPIC_API_KEY" ||
      key === "OLLAMA_URL" ||
      key === "OLLAMA_MODEL"
    ) {
      delete process.env[key];
    }
  }
  mockExit.mockClear();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

// Dynamic import to get fresh module each test
async function loadConfig() {
  // Force re-evaluation
  const mod = await import("../cli/config.js");
  return mod.resolveConfig;
}

describe("resolveConfig", () => {
  it("resolves config from CLI flags", async () => {
    const resolveConfig = await loadConfig();
    const config = resolveConfig({
      database: "postgresql://localhost/test",
      "api-key": "sk-test123",
      model: "gpt-4o",
      schema: "analytics",
    });

    expect(config.database).toBe("postgresql://localhost/test");
    expect(config.llm).toEqual(
      expect.objectContaining({ apiKey: "sk-test123", model: "gpt-4o" }),
    );
    expect(config.schema).toBe("analytics");
  });

  it("resolves database from CHATDB_DATABASE_URL env var", async () => {
    process.env.CHATDB_DATABASE_URL = "postgresql://envdb/test";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({ "api-key": "sk-test" });
    expect(config.database).toBe("postgresql://envdb/test");
  });

  it("falls back to DATABASE_URL env var", async () => {
    process.env.DATABASE_URL = "postgresql://fallback/test";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({ "api-key": "sk-test" });
    expect(config.database).toBe("postgresql://fallback/test");
  });

  it("prefers CHATDB_DATABASE_URL over DATABASE_URL", async () => {
    process.env.CHATDB_DATABASE_URL = "postgresql://primary/test";
    process.env.DATABASE_URL = "postgresql://fallback/test";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({ "api-key": "sk-test" });
    expect(config.database).toBe("postgresql://primary/test");
  });

  it("CLI flag overrides env var for database", async () => {
    process.env.DATABASE_URL = "postgresql://env/test";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({
      database: "postgresql://flag/test",
      "api-key": "sk-test",
    });
    expect(config.database).toBe("postgresql://flag/test");
  });

  it("exits if no database URL provided", async () => {
    const resolveConfig = await loadConfig();
    expect(() => resolveConfig({ "api-key": "sk-test" })).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("resolves apiKey from CHATDB_LLM_API_KEY", async () => {
    process.env.CHATDB_LLM_API_KEY = "sk-from-env";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({ database: "pg://localhost/test" });
    expect((config.llm as any).apiKey).toBe("sk-from-env");
  });

  it("falls back to OPENAI_API_KEY", async () => {
    process.env.OPENAI_API_KEY = "sk-openai-env";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({ database: "pg://localhost/test" });
    expect((config.llm as any).apiKey).toBe("sk-openai-env");
  });

  it("falls back to ANTHROPIC_API_KEY", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-env";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({ database: "pg://localhost/test" });
    expect((config.llm as any).apiKey).toBe("sk-ant-env");
  });

  it("resolves LLM URL from CHATDB_LLM_URL", async () => {
    process.env.CHATDB_LLM_URL = "http://myserver:1234";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({ database: "pg://localhost/test" });
    expect((config.llm as any).url).toBe("http://myserver:1234");
    expect((config.llm as any).provider).toBe("openai-compatible");
  });

  it("falls back to OLLAMA_URL", async () => {
    process.env.OLLAMA_URL = "http://ollama:11434";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({ database: "pg://localhost/test" });
    expect((config.llm as any).url).toBe("http://ollama:11434");
  });

  it("resolves model from CHATDB_LLM_MODEL", async () => {
    process.env.CHATDB_LLM_MODEL = "my-model";
    process.env.CHATDB_LLM_URL = "http://localhost:1234";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({ database: "pg://localhost/test" });
    expect((config.llm as any).model).toBe("my-model");
  });

  it("falls back to OLLAMA_MODEL", async () => {
    process.env.OLLAMA_MODEL = "ollama-model";
    process.env.OLLAMA_URL = "http://localhost:11434";
    const resolveConfig = await loadConfig();
    const config = resolveConfig({ database: "pg://localhost/test" });
    expect((config.llm as any).model).toBe("ollama-model");
  });

  it("exits if no LLM config provided", async () => {
    const resolveConfig = await loadConfig();
    expect(() => resolveConfig({ database: "pg://localhost/test" })).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("prefers apiKey over URL when both present", async () => {
    const resolveConfig = await loadConfig();
    const config = resolveConfig({
      database: "pg://localhost/test",
      "api-key": "sk-test",
      llm: "http://localhost:1234",
    });
    // When apiKey is present, it should be in the llm config
    expect((config.llm as any).apiKey).toBe("sk-test");
  });

  it("sets debug to true", async () => {
    const resolveConfig = await loadConfig();
    const config = resolveConfig({
      database: "pg://localhost/test",
      "api-key": "sk-test",
    });
    expect(config.debug).toBe(true);
  });

  it("passes provider flag through", async () => {
    const resolveConfig = await loadConfig();
    const config = resolveConfig({
      database: "pg://localhost/test",
      "api-key": "sk-test",
      provider: "anthropic",
    });
    expect((config.llm as any).provider).toBe("anthropic");
  });
});
