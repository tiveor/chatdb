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

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = "openai-compatible";
  private baseUrl: string;
  private model: string;
  private cachedContextLength: number | null = null;
  private cachedModelId: string | null = null;

  constructor(config: LLMProviderConfig) {
    this.baseUrl = (config.url ?? "http://localhost:11434").replace(/\/$/, "");
    this.model = config.model ?? "";
  }

  async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    const body: Record<string, unknown> = {
      messages: options.messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 256,
      response_format: {
        type: "json_schema",
        json_schema: SQL_RESPONSE_SCHEMA,
      },
    };

    if (this.model) body.model = this.model;

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 400 && text.includes("context")) {
        throw new ContextOverflowError(this.name);
      }
      throw new LLMError(`AI server error (${res.status}): ${text}`, this.name, res.status);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    if (!content) {
      throw new LLMError("No response content from AI server", this.name);
    }

    return {
      content,
      model: await this.getModelId(),
    };
  }

  async getContextLength(): Promise<number> {
    await this.fetchModelInfo();
    return this.cachedContextLength!;
  }

  async getModelId(): Promise<string> {
    await this.fetchModelInfo();
    return this.cachedModelId!;
  }

  private async fetchModelInfo(): Promise<void> {
    if (this.cachedContextLength && this.cachedModelId) return;

    try {
      const res = await fetch(`${this.baseUrl}/v1/models`);
      if (res.ok) {
        const data = await res.json();
        const model = data.data?.[0];
        this.cachedModelId = model?.id ?? "unknown";
        this.cachedContextLength =
          model?.context_length ?? model?.max_model_len ?? model?.context_window ?? 4096;
        return;
      }
    } catch {
      // ignore
    }

    this.cachedContextLength = 4096;
    this.cachedModelId = "unknown";
  }
}
