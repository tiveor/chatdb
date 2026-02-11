import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAICompatibleProvider } from "../llm/openai-compatible.js";
import { OpenAIProvider } from "../llm/openai.js";
import { AnthropicProvider } from "../llm/anthropic.js";
import { LLMError, ContextOverflowError } from "../utils/errors.js";

// === OpenAICompatibleProvider ===

describe("OpenAICompatibleProvider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("has correct name", () => {
    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234" });
    expect(provider.name).toBe("openai-compatible");
  });

  it("defaults to localhost:11434", () => {
    const provider = new OpenAICompatibleProvider({});
    // We can verify by calling generate and checking the URL
    expect(provider.name).toBe("openai-compatible");
  });

  it("strips trailing slash from URL", () => {
    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234/" });
    expect(provider.name).toBe("openai-compatible");
  });

  it("generates response successfully", async () => {
    // generate() calls fetch for completions first, then getModelId() calls fetchModelInfo()
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"sql":"SELECT 1","explanation":"test","chartType":"number"}' } }],
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "test-model", context_length: 8192 }],
        }),
      } as any);

    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234" });
    const result = await provider.generate({
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.content).toContain("SELECT 1");
    expect(result.model).toBe("test-model");
  });

  it("throws ContextOverflowError on 400 with context mention", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "context length exceeded",
      } as any);

    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234" });
    await expect(provider.generate({ messages: [{ role: "user", content: "test" }] })).rejects.toThrow(
      ContextOverflowError,
    );
  });

  it("throws LLMError on non-OK response", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "internal server error",
      } as any);

    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234" });
    await expect(provider.generate({ messages: [{ role: "user", content: "test" }] })).rejects.toThrow(LLMError);
  });

  it("throws LLMError on empty response content", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "" } }] }),
      } as any);

    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234" });
    await expect(provider.generate({ messages: [{ role: "user", content: "test" }] })).rejects.toThrow(
      "No response content",
    );
  });

  it("returns default context length when /v1/models fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("connection refused"));

    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234" });
    const ctx = await provider.getContextLength();
    expect(ctx).toBe(4096);
  });

  it("returns 'unknown' model when /v1/models fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("connection refused"));

    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234" });
    const model = await provider.getModelId();
    expect(model).toBe("unknown");
  });

  it("caches model info after first fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "cached-model", context_length: 16384 }] }),
    } as any);
    globalThis.fetch = mockFetch;

    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234" });
    await provider.getContextLength();
    await provider.getContextLength();
    await provider.getModelId();

    // Only called once thanks to caching
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("reads context_window fallback", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "m", context_window: 32768 }] }),
    } as any);

    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234" });
    expect(await provider.getContextLength()).toBe(32768);
  });

  it("reads max_model_len fallback", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "m", max_model_len: 65536 }] }),
    } as any);

    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234" });
    expect(await provider.getContextLength()).toBe(65536);
  });

  it("includes model in body when specified", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"sql":"SELECT 1","explanation":"ok","chartType":"number"}' } }] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: "m", context_length: 4096 }] }),
      } as any);
    globalThis.fetch = mockFetch;

    const provider = new OpenAICompatibleProvider({ url: "http://localhost:1234", model: "my-model" });
    await provider.generate({ messages: [{ role: "user", content: "test" }] });

    // First call is the completion call
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("my-model");
  });
});

// === OpenAIProvider ===

describe("OpenAIProvider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("has correct name", () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    expect(provider.name).toBe("openai");
  });

  it("throws on missing API key", () => {
    expect(() => new OpenAIProvider({})).toThrow(LLMError);
    expect(() => new OpenAIProvider({})).toThrow("API key is required");
  });

  it("defaults to gpt-4o-mini model", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    expect(await provider.getModelId()).toBe("gpt-4o-mini");
  });

  it("uses custom model", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test", model: "gpt-4o" });
    expect(await provider.getModelId()).toBe("gpt-4o");
  });

  it("returns known context length for gpt-4o-mini", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test", model: "gpt-4o-mini" });
    expect(await provider.getContextLength()).toBe(128_000);
  });

  it("returns known context length for gpt-4", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test", model: "gpt-4" });
    expect(await provider.getContextLength()).toBe(8_192);
  });

  it("returns override context length when provided", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test", contextLength: 50_000 });
    expect(await provider.getContextLength()).toBe(50_000);
  });

  it("returns default 128k for unknown model", async () => {
    const provider = new OpenAIProvider({ apiKey: "sk-test", model: "gpt-99-turbo" });
    expect(await provider.getContextLength()).toBe(128_000);
  });

  it("generates response successfully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"sql":"SELECT 1","explanation":"one","chartType":"number"}' } }],
      }),
    } as any);

    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    const result = await provider.generate({ messages: [{ role: "user", content: "test" }] });
    expect(result.content).toContain("SELECT 1");
    expect(result.model).toBe("gpt-4o-mini");
  });

  it("sends Authorization header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"sql":"SELECT 1","explanation":"ok","chartType":"number"}' } }] }),
    } as any);
    globalThis.fetch = mockFetch;

    const provider = new OpenAIProvider({ apiKey: "sk-my-secret" });
    await provider.generate({ messages: [{ role: "user", content: "test" }] });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer sk-my-secret");
  });

  it("uses custom base URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"sql":"SELECT 1","explanation":"ok","chartType":"number"}' } }] }),
    } as any);
    globalThis.fetch = mockFetch;

    const provider = new OpenAIProvider({ apiKey: "sk-test", url: "https://custom-api.com" });
    await provider.generate({ messages: [{ role: "user", content: "test" }] });

    expect(mockFetch.mock.calls[0][0]).toBe("https://custom-api.com/v1/chat/completions");
  });

  it("throws ContextOverflowError on 400 with context", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "maximum context length exceeded",
    } as any);

    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    await expect(provider.generate({ messages: [{ role: "user", content: "test" }] })).rejects.toThrow(
      ContextOverflowError,
    );
  });

  it("throws LLMError on non-OK response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limit exceeded",
    } as any);

    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    await expect(provider.generate({ messages: [{ role: "user", content: "test" }] })).rejects.toThrow(LLMError);
  });

  it("throws on empty response content", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" } }] }),
    } as any);

    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    await expect(provider.generate({ messages: [{ role: "user", content: "test" }] })).rejects.toThrow(
      "No response content",
    );
  });
});

// === AnthropicProvider ===

describe("AnthropicProvider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("has correct name", () => {
    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    expect(provider.name).toBe("anthropic");
  });

  it("throws on missing API key", () => {
    expect(() => new AnthropicProvider({})).toThrow(LLMError);
    expect(() => new AnthropicProvider({})).toThrow("API key is required");
  });

  it("defaults to claude-sonnet-4-5 model", async () => {
    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    expect(await provider.getModelId()).toBe("claude-sonnet-4-5-20250929");
  });

  it("returns 200k context for default model", async () => {
    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    expect(await provider.getContextLength()).toBe(200_000);
  });

  it("returns override context length when provided", async () => {
    const provider = new AnthropicProvider({ apiKey: "sk-ant-test", contextLength: 100_000 });
    expect(await provider.getContextLength()).toBe(100_000);
  });

  it("generates response with tool_use format", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "tool_use",
            name: "sql_response",
            input: { sql: "SELECT COUNT(*) FROM users", explanation: "count users", chartType: "number" },
          },
        ],
      }),
    } as any);

    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    const result = await provider.generate({
      messages: [
        { role: "system", content: "You are a SQL assistant" },
        { role: "user", content: "how many users?" },
      ],
    });

    const parsed = JSON.parse(result.content);
    expect(parsed.sql).toBe("SELECT COUNT(*) FROM users");
    expect(parsed.explanation).toBe("count users");
  });

  it("sends correct headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "tool_use", input: { sql: "SELECT 1", explanation: "ok", chartType: "number" } }],
      }),
    } as any);
    globalThis.fetch = mockFetch;

    const provider = new AnthropicProvider({ apiKey: "sk-ant-secret" });
    await provider.generate({ messages: [{ role: "user", content: "test" }] });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["x-api-key"]).toBe("sk-ant-secret");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("extracts system message as top-level field", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "tool_use", input: { sql: "SELECT 1", explanation: "ok", chartType: "number" } }],
      }),
    } as any);
    globalThis.fetch = mockFetch;

    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    await provider.generate({
      messages: [
        { role: "system", content: "System prompt here" },
        { role: "user", content: "Hello" },
      ],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toBe("System prompt here");
    // Messages should NOT contain the system message
    expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("sends tool_choice forcing sql_response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "tool_use", input: { sql: "SELECT 1", explanation: "ok", chartType: "number" } }],
      }),
    } as any);
    globalThis.fetch = mockFetch;

    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    await provider.generate({ messages: [{ role: "user", content: "test" }] });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tool_choice).toEqual({ type: "tool", name: "sql_response" });
    expect(body.tools[0].name).toBe("sql_response");
  });

  it("throws ContextOverflowError when response mentions context", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "prompt is too long for the model's context window",
    } as any);

    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    await expect(provider.generate({ messages: [{ role: "user", content: "test" }] })).rejects.toThrow(
      ContextOverflowError,
    );
  });

  it("throws LLMError on non-OK response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "internal error",
    } as any);

    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    await expect(provider.generate({ messages: [{ role: "user", content: "test" }] })).rejects.toThrow(LLMError);
  });

  it("throws when no tool_use block in response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Sorry, I cannot help" }],
      }),
    } as any);

    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    await expect(provider.generate({ messages: [{ role: "user", content: "test" }] })).rejects.toThrow(
      "No tool_use response",
    );
  });
});
