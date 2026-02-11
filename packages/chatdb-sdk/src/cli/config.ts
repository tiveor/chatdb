import type { ChatDBConfig } from "../types.js";

function env(primary: string, ...fallbacks: string[]): string | undefined {
  const value = process.env[primary];
  if (value) return value;
  for (const fb of fallbacks) {
    if (process.env[fb]) return process.env[fb];
  }
  return undefined;
}

export function resolveConfig(flags: Record<string, string | boolean | undefined>): ChatDBConfig {
  const database =
    (flags.database as string) ??
    env("CHATDB_DATABASE_URL", "DATABASE_URL");

  if (!database) {
    console.error("Error: Database URL is required.");
    console.error("Set CHATDB_DATABASE_URL or DATABASE_URL, or use --database flag.");
    process.exit(1);
  }

  const apiKey =
    (flags["api-key"] as string) ??
    env("CHATDB_LLM_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY");

  const llmUrl =
    (flags.llm as string) ??
    env("CHATDB_LLM_URL", "OLLAMA_URL");

  const model =
    (flags.model as string) ??
    env("CHATDB_LLM_MODEL", "OLLAMA_MODEL");

  const provider = flags.provider as string | undefined;

  // Build LLM config
  let llm: ChatDBConfig["llm"];
  if (apiKey) {
    llm = {
      apiKey,
      model: model || undefined,
      provider: provider as any,
      url: llmUrl || undefined,
    };
  } else if (llmUrl) {
    llm = {
      url: llmUrl,
      model: model || undefined,
      provider: (provider as any) ?? "openai-compatible",
    };
  } else {
    console.error("Error: LLM configuration is required.");
    console.error("Set CHATDB_LLM_API_KEY or CHATDB_LLM_URL, or use --api-key / --llm flags.");
    process.exit(1);
  }

  return {
    database,
    llm,
    schema: flags.schema as string | undefined,
    debug: true,
  };
}
