import type { LLMProviderConfig } from "../types.js";
import { ChatDBError } from "../utils/errors.js";
import type { LLMProvider } from "./types.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";

export async function resolveLLMProvider(config: string | LLMProviderConfig): Promise<LLMProvider> {
  if (typeof config === "string") {
    if (config.startsWith("sk-ant-")) {
      const { AnthropicProvider } = await import("./anthropic.js");
      return new AnthropicProvider({ apiKey: config });
    }
    if (config.startsWith("sk-")) {
      const { OpenAIProvider } = await import("./openai.js");
      return new OpenAIProvider({ apiKey: config });
    }
    if (config.startsWith("http")) {
      return new OpenAICompatibleProvider({ url: config });
    }
    throw new ChatDBError(
      "Cannot auto-detect LLM provider from string. Use { provider, apiKey } config object.",
    );
  }

  // Explicit provider field
  if (config.provider === "openai") {
    const { OpenAIProvider } = await import("./openai.js");
    return new OpenAIProvider(config);
  }
  if (config.provider === "anthropic") {
    const { AnthropicProvider } = await import("./anthropic.js");
    return new AnthropicProvider(config);
  }
  if (config.provider === "openai-compatible") {
    return new OpenAICompatibleProvider(config);
  }

  // Auto-detect from apiKey prefix
  if (config.apiKey?.startsWith("sk-ant-")) {
    const { AnthropicProvider } = await import("./anthropic.js");
    return new AnthropicProvider(config);
  }
  if (config.apiKey?.startsWith("sk-")) {
    const { OpenAIProvider } = await import("./openai.js");
    return new OpenAIProvider(config);
  }

  // Has URL but no apiKey → local LLM (openai-compatible)
  if (config.url && !config.apiKey) {
    return new OpenAICompatibleProvider(config);
  }

  // Has URL + apiKey → OpenAI with custom endpoint
  if (config.url && config.apiKey) {
    const { OpenAIProvider } = await import("./openai.js");
    return new OpenAIProvider(config);
  }

  throw new ChatDBError("Cannot determine LLM provider. Specify provider explicitly.");
}
