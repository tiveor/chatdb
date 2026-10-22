# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-02-11

Initial release.

### Added

- Natural-language to SQL via `@tiveor/chatdb` SDK.
- One-off `query()` and conversational `ask()` APIs with multi-turn context.
- Database support for **PostgreSQL**, **MySQL**, and **SQLite** with auto-detection from the connection string.
- LLM support for **OpenAI**, **Anthropic**, and any **OpenAI-compatible** endpoint (Ollama, LM Studio, vLLM).
- SQL Guard that blocks anything other than `SELECT` statements.
- Schema introspection with caching.
- Chart-type suggestion in query results (`bar`, `line`, `pie`, etc.).
- CLI: `npx @tiveor/chatdb -d <url> -k <key>` for interactive use.
- Web app (Hono API + React client) demoing the SDK end-to-end.
- MIT license and public repository.

[Unreleased]: https://github.com/tiveor/chatdb/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tiveor/chatdb/releases/tag/v0.1.0
