# MCP Server Guide

A minimal JSON-RPC 2.0 server that exposes repository knowledge (logs, memory capsules, RAG index) with optional write methods and summarization.

## Start
```bash
(cd site && npm run -s mcp:serve -- --port 12812)
```
Optional auth:
```bash
export MCP_API_KEY="mysecret"
(cd site && MCP_API_KEY=$MCP_API_KEY npm run -s mcp:serve)
```

## Methods
Read:
- logs.list { tag?, limit? }
- logs.get { href | path }
- memory.list { tag?, limit? }
- memory.get { id }
- rag.search { query, k? }
- health.snapshot
- token.ledger
- agent.summarize { query?, limit?, provider? }  (provider can be 'local' to force local TF-IDF)
- mcp.logs.recent { limit?, method?, ok? }

REST mirrors (no JSON-RPC envelope):
- GET /mcp/health → same as health.snapshot
- GET /mcp/recent?limit=50&method=rag.search&ok=true → filter recent log index

Write (API key required):
- ingest.add { title?, content, tags?[] }
- memory.add { title, content, tags?[], source?, summary? }

## Summarization
`agent.summarize` ranks context via local TF‑IDF; if `OPENAI_API_KEY` or `GEMINI_API_KEY` is set and provider != 'local', it attempts an external model (OpenAI preferred). Fallback returns deterministic local summary with `degraded: true`.

## Logging & Rate Limiting
- Per-request log: `logs/memory/mcp/<YYYY-MM-DD>/<timestamp>-<id>.json`
- Rolling index (last 500): `logs/memory/mcp/index.json`
- Daily counter: `logs/memory/mcp/rate-limits.json` (fields: date, counts.auth, counts.anon, limit)
- Set daily cap: `MCP_DAILY_REQ_LIMIT` (default 500)

## Example Request
```bash
curl -s -X POST localhost:12812/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"rag.search","params":{"query":"memory index"}}'
```
If auth:
```bash
curl -s -X POST localhost:12812/mcp \
  -H 'content-type: application/json' \
  -H "x-api-key: $MCP_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"logs.list","params":{"limit":2}}'
```

## Error Codes
`INVALID_REQUEST`, `METHOD_NOT_FOUND`, `INVALID_INPUT`, `NOT_FOUND`, `UNAUTHORIZED`, `RATE_LIMIT`, `INTERNAL`.

## Environment Variables
| Variable | Purpose | Default |
|----------|---------|---------|
| MCP_API_KEY | Enable auth / required for write methods | (unset) |
| MCP_PORT | Server port | 12812 |
| MCP_DAILY_REQ_LIMIT | Daily allowed requests (per process) | 500 |
| OPENAI_API_KEY | Enables OpenAI summarize provider | (unset) |
| GEMINI_API_KEY | Enables Gemini summarize provider | (unset) |
| TOKEN_DAILY_LIMIT | Token ledger daily cap (unrelated to MCP) | 500000 |

## Development Notes
- Server reads prebuilt indices in `site/public/*` produced by `prebuild.mjs`.
- Ensure `npm run build` or `node scripts/prebuild.mjs` executed before complex queries.
- Logging never blocks responses; errors silently ignored.

## Future Ideas
- Streaming responses (JSON lines) for long operations.
- Batch methods (multi-call in one envelope).
- Auth scopes for read vs write.
- Enhanced semantic ranking (embeddings) while staying local-first.
