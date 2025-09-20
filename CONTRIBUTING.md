# Contributing

Thanks for improving the Chat Log + Local RAG + MCP toolkit. This doc captures the basic workflow.

## Quick Start
```bash
npm -C site install
npm -C site run build
npm -C site run export
```
Open `site/out/index.html` or run a simple static server to preview.

## Development Commands
| Action | Command |
|--------|---------|
| Lint   | `npm -C site run lint` |
| Auto-fix | `npm -C site run lint:fix` |
| Typecheck | `npm -C site run typecheck` |
| Build (Next.js) | `npm -C site run build` |
| Export static | `npm -C site run export` |
| RAG Rebuild | `npm -C site run rag:build` |
| MCP Server | `npm -C site run mcp:serve` |
| MCP Test | `npm -C site run test:mcp` |
| Ledger Test | `npm -C site run test:ledger` |
| Tools Test (soft-fail) | `npm -C site run tools:test` |

## MCP Summarization Providers
If `OPENAI_API_KEY` or `GEMINI_API_KEY` is set, `agent.summarize` will attempt a provider call (OpenAI preferred). Force local mode with param `{ provider: "local" }`.

## Rate Limits
Set `MCP_DAILY_REQ_LIMIT` to cap daily JSON-RPC calls. The server persists counts and configured limit in `logs/memory/mcp/rate-limits.json`.

## Adding Logs
- Place inbound markdown into `logs/incoming/` and run `npm -C site run route:logs` (or use `watch:incoming`).
- Dated folders (`logs/YYYY/MM/DD/`) get created during routing.

## Memory Capsules
Create via MCP `memory.add` or manually add JSON under `logs/memory/` following existing schema.

## PR Checklist
- [ ] Lint clean (warnings acceptable, no errors)
- [ ] Typecheck passes
- [ ] `npm -C site run build` succeeds
- [ ] MCP integration test passes
- [ ] No unintended large binary assets committed
- [ ] Updated docs (README or `docs/*`) for new endpoints/features

## Coding Style
Primarily standard TypeScript/ES modules. Avoid heavy dependencies; keep everything local-first. Use small utility functions instead of large frameworks for indexing & ranking.

## Future Areas
- Embedding-based semantic search
- Streaming JSON-RPC responses
- Multi-provider summarization quality comparison harness

Happy hacking!
