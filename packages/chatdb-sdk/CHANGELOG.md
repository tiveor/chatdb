# Changelog

All notable changes to `@tiveor/chatdb` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-02-11

Initial release.

### Added

- `ChatDB` class with one-off `query()` and conversational `ask()` APIs (multi-turn context).
- Database adapters for **PostgreSQL**, **MySQL**, and **SQLite**, auto-detected from the connection string.
- LLM providers: **OpenAI**, **Anthropic**, and any **OpenAI-compatible** endpoint (Ollama, LM Studio, vLLM), auto-detected from the API key.
- Schema introspection with in-memory caching.
- SQL Guard that rejects anything other than `SELECT` statements.
- Chart-type suggestion returned alongside SQL, explanation, and rows.
- CLI entry point (`chatdb` / `npx @tiveor/chatdb`) for interactive use.
- ESM + CJS builds with bundled type definitions.

[Unreleased]: https://github.com/tiveor/chatdb/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tiveor/chatdb/releases/tag/v0.1.0
