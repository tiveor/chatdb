export class ChatDBError extends Error {
  code: string;
  constructor(message: string, code = "CHATDB_ERROR") {
    super(message);
    this.name = "ChatDBError";
    this.code = code;
  }
}

export class ValidationError extends ChatDBError {
  sql: string;
  constructor(message: string, sql: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.sql = sql;
  }
}

export class LLMError extends ChatDBError {
  provider: string;
  statusCode?: number;
  constructor(message: string, provider: string, statusCode?: number) {
    super(message, "LLM_ERROR");
    this.name = "LLMError";
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

export class DatabaseError extends ChatDBError {
  dialect: string;
  constructor(message: string, dialect: string) {
    super(message, "DATABASE_ERROR");
    this.name = "DatabaseError";
    this.dialect = dialect;
  }
}

export class ContextOverflowError extends LLMError {
  constructor(provider: string) {
    super(
      "Conversation too long for model context window. Call clearHistory().",
      provider,
    );
    this.code = "CONTEXT_OVERFLOW";
    this.name = "ContextOverflowError";
  }
}
