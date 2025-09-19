# MCP Integration Plan

## Goal
Introduce a Model Context Protocol (MCP) server layer that exposes repository knowledge (logs, memory, RAG, health) and controlled tool actions (ingest, summarize, memory add) to external agent clients in a safe, quota‑aware manner.

## Principles
- Read-first: default capabilities are read/inspect; write actions require explicit allowlisting.
- Deterministic side-effects: every mutating action produces a structured receipt (JSON) and optional reversible patch.
- Security & Isolation: no arbitrary shell; only curated verbs; path allowlists.
- Observability: every request + response logged to `logs/memory/mcp/` with rolling index.
- Quota-aware: token ledger consulted before remote LLM-expensive operations.

## High-Level Architecture
```
+------------------+        JSON-RPC / MCP         +-----------------------+
|  Agent Client(s) |  <------------------------->  |  MCP Server (node)    |
+------------------+                               +-----------+-----------+
                                                             |
                                           +-----------------+------------------+
                                           | Domain Adapters / Providers       |
                                           | - Logs Index (logs-index.json)    |
                                           | - Memory Index (memory-index.json)|
                                           | - RAG Index (rag-index.json)      |
                                           | - Token Ledger (token-ledger.json)|
                                           | - Health Snapshot (health.json)   |
                                           +-----------------+------------------+
                                                             |
                                           +-----------------+------------------+
                                           |  Tool Implementations             |
                                           |  ingest, summarize, memory.add    |
                                           +-----------------------------------+
```

## Proposed MCP Methods
| Method | Type | Description | Auth Needed | Token Impact |
|--------|------|-------------|-------------|--------------|
| `logs.list` | query | List logs with metadata (date, size, tags) | no | minimal |
| `logs.get` | query | Fetch single log content by path/id | no | content size |
| `memory.list` | query | List memory capsules summary | no | minimal |
| `memory.get` | query | Fetch memory capsule content | no | capsule size |
| `rag.search` | query | TF-IDF search returning top chunks + scores | no | small |
| `health.snapshot` | query | Return current health.json content | no | minimal |
| `token.ledger` | query | Return daily usage + limit | no | minimal |
| `ingest.add` | command | Add raw markdown (with optional tags) to incoming | yes | small |
| `memory.add` | command | Add a memory capsule (title, text, tags) | yes | small |
| `agent.summarize` | command | Run a constrained summary over recent logs | yes | potentially large (LLM) |
| `plan.improvements` | command | Generate improvement suggestions (uses provider) | yes | moderate |

## Authentication / Authorization
- Simple shared secret env `MCP_API_KEY` for first iteration (header or param).
- Future: per-key scopes (read, write:ingest, write:memory, run:agent).

## Token / Cost Control
- Before any provider call (`agent.summarize`, `plan.improvements`), check projected cost: current day approximate + requested estimate ≤ `TOKEN_DAILY_LIMIT`.
- If over limit → degrade to local rag-only summarization and set `degraded: true` in response.

## Error Model
```
{
  "error": {
    "code": "LIMIT_EXCEEDED" | "UNAUTHORIZED" | "NOT_FOUND" | "INVALID_INPUT" | "INTERNAL",
    "message": "Human readable",
    "details": { ... optional context }
  }
}
```
Success responses include `requestId` and optionally `metrics` (latency ms, approxTokens).

## Logging & Auditing
- Each request logged to `logs/memory/mcp/YYYY-MM-DD/<timestamp>-<requestId>.json`.
- Rolling index `logs/memory/mcp/index.json` aggregated on each write (bounded by last N = 500 entries).

## Implementation Steps
1. Scaffold `site/scripts/mcp-server.mjs` (HTTP + JSON-RPC style POST `/mcp`).
2. Add method router with validation + allowlisted verbs.
3. Implement read-only methods (logs.list, logs.get, memory.list, memory.get, rag.search, health.snapshot, token.ledger).
4. Add write methods (ingest.add, memory.add) with secret check.
5. Integrate provider selection + quota check for agent.summarize / plan.improvements.
6. Update token ledger if provider call accepted.
7. Add logging + index maintenance.
8. Provide CLI launcher `npm run mcp:serve`.
9. Document usage in README + automation docs.

## Data Shapes (Draft)
`rag.search` result:
```
{
  "chunks": [ { "id": "path#offset", "path": "logs/2025/09/19/example.md", "score": 0.42, "snippet": "..." } ],
  "tookMs": 12
}
```

`agent.summarize` result:
```
{
  "summary": "...",
  "improvements": ["..."],
  "provider": "gemini|openai|rag",
  "degraded": false,
  "approxTokens": 3456
}
```

## Security Considerations
- No arbitrary file write outside explicit folders.
- Reject paths containing `..` or starting with `/` (enforce relative roots).
- Size limits: reject single request body > 200KB.
- Rate limiting (future): simple token bucket in-memory or file-based counter.

## Future Enhancements
- Multi-tenant keys + per-scope quotas.
- WebSocket streaming for long provider responses.
- Embedding-based hybrid search.
- Structured diff summarization (cluster edits before summarizing).
- Fine-grained token ledger with per-method accounting.

## Open Questions
- Should ingest/memory actions trigger immediate prebuild? (Probably not; batch via workflow.)
- Add `logs.delta` method that returns list of changed logs since commit X? Useful for external orchestrators.

---
This plan can now be executed incrementally; start with read-only endpoints to validate server skeleton.
