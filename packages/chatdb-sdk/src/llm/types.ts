export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMGenerateOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  responseSchema?: Record<string, unknown>;
}

export interface LLMGenerateResult {
  content: string;
  model: string;
}

export interface LLMProvider {
  readonly name: string;
  generate(options: LLMGenerateOptions): Promise<LLMGenerateResult>;
  getContextLength(): Promise<number>;
  getModelId(): Promise<string>;
}
