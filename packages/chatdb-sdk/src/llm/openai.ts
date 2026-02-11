import type { LLMProviderConfig } from "../types.js";
import { ContextOverflowError, LLMError } from "../utils/errors.js";
import type { LLMGenerateOptions, LLMGenerateResult, LLMProvider } from "./types.js";

const SQL_RESPONSE_SCHEMA = {
  name: "sql_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      sql: { type: "string" },
      explanation: { type: "string" },
      chartType: { type: "string", enum: ["bar", "line", "pie", "table", "number"] },
    },
    required: ["sql", "explanation", "chartType"],
    additionalProperties: false,
  },
};

// Known context lengths for common models
const MODEL_CONTEXT: Record<string, number> = {
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4-turbo": 128_000,
  "gpt-4": 8_192,
  "gpt-3.5-turbo": 16_385,
  "o1": 200_000,
  "o1-mini": 128_000,
  "o3-mini": 200_000,
};

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private contextLengthOverride?: number;

  constructor(config: LLMProviderConfig) {
    this.baseUrl = (config.url ?? "https://api.openai.com").replace(/\/$/, "");
    this.apiKey = config.apiKey ?? "";
    this.model = config.model ?? "gpt-4o-mini";
    this.contextLengthOverride = config.contextLength;

    if (!this.apiKey) {
      throw new LLMError("OpenAI API key is required", this.name);
    }
  }

  async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 256,
      response_format: {
        type: "json_schema",
        json_schema: SQL_RESPONSE_SCHEMA,
      },
    };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 400 && text.includes("context")) {
        throw new ContextOverflowError(this.name);
      }
      throw new LLMError(`OpenAI error (${res.status}): ${text}`, this.name, res.status);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    if (!content) {
      throw new LLMError("No response content from OpenAI", this.name);
    }

    return { content, model: this.model };
  }

  async getContextLength(): Promise<number> {
    if (this.contextLengthOverride) return this.contextLengthOverride;
    return MODEL_CONTEXT[this.model] ?? 128_000;
  }

  async getModelId(): Promise<string> {
    return this.model;
  }
}
