import type { LLMProviderConfig } from "../types.js";
import { ContextOverflowError, LLMError } from "../utils/errors.js";
import type { LLMGenerateOptions, LLMGenerateResult, LLMProvider } from "./types.js";

const SQL_RESPONSE_TOOL = {
  name: "sql_response",
  description: "Generate a SQL query response with explanation and chart type",
  input_schema: {
    type: "object",
    properties: {
      sql: { type: "string", description: "The SQL SELECT query" },
      explanation: { type: "string", description: "Brief explanation of the query results" },
      chartType: {
        type: "string",
        enum: ["bar", "line", "pie", "table", "number"],
        description: "Suggested chart type for visualization",
      },
    },
    required: ["sql", "explanation", "chartType"],
  },
};

const MODEL_CONTEXT: Record<string, number> = {
  "claude-sonnet-4-5-20250929": 200_000,
  "claude-opus-4-6": 200_000,
  "claude-haiku-4-5-20251001": 200_000,
  "claude-3-5-sonnet-20241022": 200_000,
  "claude-3-5-haiku-20241022": 200_000,
  "claude-3-opus-20240229": 200_000,
};

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private apiKey: string;
  private model: string;
  private contextLengthOverride?: number;

  constructor(config: LLMProviderConfig) {
    this.apiKey = config.apiKey ?? "";
    this.model = config.model ?? "claude-sonnet-4-5-20250929";
    this.contextLengthOverride = config.contextLength;

    if (!this.apiKey) {
      throw new LLMError("Anthropic API key is required", this.name);
    }
  }

  async generate(options: LLMGenerateOptions): Promise<LLMGenerateResult> {
    // Anthropic uses system as top-level field, not a message
    const systemMessage = options.messages.find((m) => m.role === "system");
    const nonSystemMessages = options.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: options.maxTokens ?? 256,
      temperature: options.temperature ?? 0.1,
      system: systemMessage?.content ?? "",
      messages: nonSystemMessages,
      tools: [SQL_RESPONSE_TOOL],
      tool_choice: { type: "tool", name: "sql_response" },
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (text.includes("context") || text.includes("too long")) {
        throw new ContextOverflowError(this.name);
      }
      throw new LLMError(`Anthropic error (${res.status}): ${text}`, this.name, res.status);
    }

    const data = await res.json();

    // Extract tool_use content block
    const toolUse = data.content?.find((block: any) => block.type === "tool_use");
    if (!toolUse?.input) {
      throw new LLMError("No tool_use response from Anthropic", this.name);
    }

    const content = JSON.stringify(toolUse.input);
    return { content, model: this.model };
  }

  async getContextLength(): Promise<number> {
    if (this.contextLengthOverride) return this.contextLengthOverride;
    return MODEL_CONTEXT[this.model] ?? 200_000;
  }

  async getModelId(): Promise<string> {
    return this.model;
  }
}
