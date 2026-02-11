import { describe, it, expect, vi } from "vitest";
import { ChatDBError } from "../utils/errors.js";

// Mock the provider modules
vi.mock("../llm/openai.js", () => ({
  OpenAIProvider: class MockOpenAI {
    name = "openai";
    constructor(public config: any) {}
  },
}));
vi.mock("../llm/anthropic.js", () => ({
  AnthropicProvider: class MockAnthropic {
    name = "anthropic";
    constructor(public config: any) {}
  },
}));
vi.mock("../llm/openai-compatible.js", () => ({
  OpenAICompatibleProvider: class MockCompatible {
    name = "openai-compatible";
    constructor(public config: any) {}
  },
}));

const { resolveLLMProvider } = await import("../llm/registry.js");

describe("resolveLLMProvider", () => {
  // === String auto-detection ===

  it("detects Anthropic from sk-ant- prefix", async () => {
    const provider: any = await resolveLLMProvider("sk-ant-abc123");
    expect(provider.name).toBe("anthropic");
  });

  it("detects OpenAI from sk- prefix", async () => {
    const provider: any = await resolveLLMProvider("sk-abc123");
    expect(provider.name).toBe("openai");
  });

  it("detects OpenAI-compatible from http URL", async () => {
    const provider: any = await resolveLLMProvider("http://localhost:11434");
    expect(provider.name).toBe("openai-compatible");
  });

  it("detects OpenAI-compatible from https URL", async () => {
    const provider: any = await resolveLLMProvider("https://my-ollama-server.com");
    expect(provider.name).toBe("openai-compatible");
  });

  it("throws for unrecognized string", async () => {
    await expect(resolveLLMProvider("random-string")).rejects.toThrow(ChatDBError);
    await expect(resolveLLMProvider("random-string")).rejects.toThrow("Cannot auto-detect");
  });

  // === Explicit provider field ===

  it("uses explicit openai provider", async () => {
    const provider: any = await resolveLLMProvider({ provider: "openai", apiKey: "sk-test" });
    expect(provider.name).toBe("openai");
  });

  it("uses explicit anthropic provider", async () => {
    const provider: any = await resolveLLMProvider({ provider: "anthropic", apiKey: "sk-ant-test" });
    expect(provider.name).toBe("anthropic");
  });

  it("uses explicit openai-compatible provider", async () => {
    const provider: any = await resolveLLMProvider({
      provider: "openai-compatible",
      url: "http://localhost:1234",
    });
    expect(provider.name).toBe("openai-compatible");
  });

  // === apiKey prefix auto-detection (config object) ===

  it("auto-detects Anthropic from apiKey prefix in config", async () => {
    const provider: any = await resolveLLMProvider({ apiKey: "sk-ant-secret" });
    expect(provider.name).toBe("anthropic");
  });

  it("auto-detects OpenAI from apiKey prefix in config", async () => {
    const provider: any = await resolveLLMProvider({ apiKey: "sk-openai-key" });
    expect(provider.name).toBe("openai");
  });

  // === URL-based detection ===

  it("uses openai-compatible for URL without apiKey", async () => {
    const provider: any = await resolveLLMProvider({ url: "http://localhost:11434" });
    expect(provider.name).toBe("openai-compatible");
  });

  it("uses OpenAI for URL with apiKey", async () => {
    const provider: any = await resolveLLMProvider({
      url: "https://custom-openai.com",
      apiKey: "custom-key-123",
    });
    expect(provider.name).toBe("openai");
  });

  // === Error cases ===

  it("throws for empty config object", async () => {
    await expect(resolveLLMProvider({})).rejects.toThrow(ChatDBError);
    await expect(resolveLLMProvider({})).rejects.toThrow("Cannot determine LLM provider");
  });

  // === Anthropic key takes priority over generic sk- ===
  it("sk-ant- prefix wins over generic sk- prefix", async () => {
    const provider: any = await resolveLLMProvider("sk-ant-test123");
    expect(provider.name).toBe("anthropic");
  });
});
