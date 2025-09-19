# AxEThrill_QENETiX_GPT_Actions_Chat_Log

[![Deploy](https://github.com/SpiralCloudOmega/AxEThrill_QENETiX_GPT_Actions_Chat_Log/actions/workflows/deploy-pages.yml/badge.svg)](.github/workflows/deploy-pages.yml)

A static Next.js 14 UI + local-first AI toolkit to browse and analyze Markdown chat logs in `logs/`, deployed to GitHub Pages. The client auto-detects the GitHub Pages `basePath` at runtime, so local (`/`) and Pages (`/REPO_NAME`) both work without extra config.

## Features
- Auto-discovers `logs/**/*.md`
- Static list & detail pages (Next.js App Router + `next export`)
- Client-side TF‑IDF search with tag filtering & recent searches
- GitHub Pages-friendly `basePath` / asset prefix auto-detection
- OpenGraph/Twitter metadata, `robots.txt`, `sitemap.xml`
- Prebuild: logs index, RSS feed(s), co-occurrence learning policy, memory index
- Git commit graph + repo tree JSON for lightweight visualization
- Local RAG index (document+chunk vectors) and PNG capsule embedding
- Self-learning "Next options" tag suggestions (`learn-policy.json`)
- Related logs with cosine similarity + tag-overlap (Jaccard) boost (configurable)
- Durable JSON memory capsules + `/memory` explorer UI
- Sublime/Monokai-inspired syntax highlighting + per-block copy buttons
- Safe grep tool (allowlisted roots) & safe scraper (URL/file → Markdown, SSRF guard)
- Mini Clip UI (`/ui/clip/`) to capture external content into memory
- Local-first AI CLI with optional Gemini/OpenAI providers & offline RAG-only mode
- Runtime UI config (`/ui/config.json`) for related/search/suggestions tuning & tag aliases
- SSE streaming endpoint `/stream` (chunked JSON events)
- Health snapshot page (`/health`) + raw `health.json` and lightweight `ping.json`
- Bundle size report emitted as `bundle-report.json` after build

### Autonomous Mode & Continuous Agents
This repo can operate in a hands‑free mode:

- `continuous-agents.yml` runs every 6 hours and on pushes that modify `logs/**/*.md`.
- It prebuilds indexes, picks an AI provider (prefers Gemini → then OpenAI → else offline `rag`), runs a concise Agent Zero summary prompt, updates memory index, and auto-commits changes.
- Monthly deeper analysis lives in `monthly-agents.yml`.

Provider precedence (workflows):
1. `GEMINI_API_KEY` present → `gemini`
2. else `OPENAI_API_KEY` present → `openai`
3. else → `rag` (offline only)

Override locally:
```bash
AI_PROVIDER=gemini (cd site && npm run -s ai:ask -- "Summarize new logs")
AI_PROVIDER=rag (cd site && npm run -s ai:chat)
```

Safety guards you may add later:
- Large batch guard (skip if > N new logs).
- Token usage caps (count RAG snippet chars before requesting provider).
- Agent state checkpointing in `logs/memory/agent-state/`.

No manual approval is required for these workflows if repo Actions permissions allow direct pushes and secrets are configured.

#### Continuous Agent Safeguards

The `continuous-agents.yml` workflow now includes:
- Batch guard heuristic: estimates token usage (`approxTokens ≈ changedChars / 4`). If it exceeds `BATCH_GUARD_LIMIT * 1000`, the run is auto-skipped to avoid runaway spend (default limit 150k tokens equivalent).
- State checkpoint: `logs/memory/agent-state/continuous-state.json` tracks the last processed commit & stats.
- Provider override: set `AI_PROVIDER_FORCE=gemini|openai|rag` in workflow secrets to force a provider even if others are present.

Environment variables (workflows side):
| Variable | Purpose | Default |
|----------|---------|---------|
| `AI_PROVIDER_FORCE` | Force provider precedence | auto-detect |
| `BATCH_GUARD_LIMIT` | Upper (k-token) heuristic threshold | 150 |

CLI still uses `AI_PROVIDER` (runtime override) while automation can hard-force with `AI_PROVIDER_FORCE`.

#### Ingestion Helper

Bulk import external markdown using the ingestion script:
```bash
node site/scripts/ingest.mjs ./some-folder
node site/scripts/ingest.mjs docs/**/*.md --tags research,planning
node site/scripts/ingest.mjs notes/today.md --tags quick
```
Features:
- Accepts file, directory, or glob.
- Ensures a title (first heading or derives from filename).
- Optional `--tags tag1,tag2` adds frontmatter.
- Writes to `logs/incoming/` (preserves date if parseable in path/name).

Follow-up: run `npm run --prefix site route:logs` (or the watcher) so they move into dated folders; the continuous workflow will pick up changes automatically on push.

#### Docker & Compose

Included multi‑stage `Dockerfile` targets:
- `build` (installs + exports site)
- `web` (nginx serving static `out/`)
- `agent` (Node runtime for orchestrated agent scripts)

`docker-compose.yml` services:
- `web` (port 3000 → nginx 80)
- `agent` (runs orchestrator; mount `./logs` & `./public`)

Quick start:
```bash
docker compose build
OPENAI_API_KEY=... GEMINI_API_KEY=... docker compose up -d
docker compose logs -f agent
```

Rebuild static export locally (without compose):
```bash
cd site
node scripts/prebuild.mjs
npm run build
```

See `docs/automation.md` for a deeper architecture & extension guide.

## Local development
From the `site/` folder:

1. Install dependencies
2. Start dev server

Put some markdown in `logs/2025/09/17/example.md` and refresh the index page.

## Deployment
Pushing to `main` publishes the site to GitHub Pages via `.github/workflows/deploy-pages.yml`.

### GitHub Pages setup
1. Repo Settings → Pages → Source: GitHub Actions.
2. Merge/push to `main`.
3. Workflow steps: install deps → prebuild indices → `next build` → `next export` → deploy `site/out`.
4. Visit: `https://<owner>.github.io/<repo>/`.

Runtime fetches compute a base path by inspecting any loaded `/_next/` script URL, so no extra env is required for Pages.

### Tag normalization & aliases
Tags are:
1. Lowercased
2. Internal whitespace collapsed
3. Single trailing `: ; , .` stripped
4. Mapped through `tagAliases` (from `site/public/ui/config.json`)

Example alias config:
```json
{
	"tagAliases": { "nvidia code:": "nvidia", "nvidia code": "nvidia" }
}
```
Run `npm run prebuild` (or push) to propagate to logs index, RAG, and learning policy.

### Build health metadata
The prebuild emits `health.json` containing a lightweight snapshot:
```jsonc
{
	"generatedAt": "2025-09-18T12:34:56.789Z",
	"commit": "<full sha>",
	"shortCommit": "<12 chars>",
	"logs": 42,
	"uniqueTags": 17,
	"rag": { "chunks": 180, "terms": 640 },
	"memory": { "items": 7 },
	"commits": 120
}
```
Useful for uptime/status widgets or CI comparisons.

### Theme override toggle
UI includes a theme selector (System / Light / Dark) that sets `data-theme` on `<html>`; dark mode no longer relies solely on the OS preference.

### Monitoring & bundle report
- Quick uptime: fetch `/ping.json` → `{ ok, shortCommit, generatedAt }`
- Detailed snapshot: `/health.json` or visit `/health`
- Bundle sizing: after `next build`, `bundle-report.json` lists largest JS chunks (top 30) and total bytes.

Example `bundle-report.json` (truncated):
```json
{
	"generatedAt": "2025-09-18T12:34:56.789Z",
	"totalBytes": 123456,
	"totalHuman": "120.56 KB",
	"count": 17,
	"top": [ { "file": "chunks/app/page-abc123.js", "bytes": 34567, "human": "33.77 KB" } ]
}
```

## Project layout
- `site/` Next.js app (App Router)
- `logs/` Markdown sources (at repo root)
- `site/scripts/prebuild.mjs` Prebuild index + RSS feed + graph/tree + RAG
- `site/scripts/build-rag.mjs` Build TF‑IDF RAG index and PNG capsule
- `site/scripts/extract-rag.mjs` Reconstruct JSON from rag-capsule.png
- `site/scripts/ai-cli.mjs` Local AI CLI (ask/chat/rag/serve)
- `site/scripts/providers/{gemini,openai}.mjs` Optional provider adapters
- `site/scripts/tools/{memory,grep,scraper}.mjs` Tools used by CLI/API
	- `memory`: add/build/list/search JSON capsules in `logs/memory/`
	- `grep`: safe regex search within allowlisted roots
	- `scraper`: safe URL/file scraping to Markdown/Text/JSON

## Scripts

Run from `site/`:

- `npm run prebuild` — generate indexes, feeds, graph/tree, and RAG capsule
- `npm run build` — build the static site
- `npm run save:chat` — save a new chat log interactively
- `npm run route:logs` — route incoming logs into dated folders
- `npm run watch:incoming` — watch and auto-route incoming logs
- `npm run probe` — probe system and write rig-status.json
- `npm run rag:build` — build TF‑IDF RAG index and PNG capsule
- `npm run rag:extract` — reconstruct JSON from rag-capsule.png
- `npm run ai:ask -- "question"` — ask with local RAG context and your chosen provider
- `npm run ai:chat` — interactive chat that saves transcript to logs/incoming
- `npm run ai:serve` — start a tiny HTTP API exposing /ask and /rag
- `npm run tools:test` — run a tiny sanity test of memory and grep tools

## AI CLI

The AI CLI is local-first: it retrieves relevant context from your logs using the TF‑IDF RAG index, and can optionally call a cloud provider to synthesize an answer.

- Providers: set `AI_PROVIDER=gemini|openai|rag` or pass `--provider=...`.
	- Gemini: set `GEMINI_API_KEY` (and optional `GEMINI_MODEL`, default `gemini-1.5-flash-latest`).
	- OpenAI: set `OPENAI_API_KEY` (and optional `OPENAI_MODEL`, default `gpt-4o-mini`).
	- rag: fully offline; returns top-matching snippets and sources without LLM calls.

Examples:

```bash
# One-shot ask with Gemini
(cd site && GEMINI_API_KEY=... npm run -s ai:ask -- "How to list Vulkan devices?")

# Ask using local-only RAG (no API keys)
(cd site && npm run -s ai:ask -- --provider=rag "UE5 shader compile cache")

# Interactive chat, save and auto-route
(cd site && GEMINI_API_KEY=... npm run -s ai:chat -- --route)

# Start a tiny local server
(cd site && npm run -s ai:serve -- --provider=rag --port=11435)
```

Transcripts are saved under `logs/incoming` and can be routed into dated folders by running `npm run --prefix site route:logs` or leaving `watch:incoming` running.

## Memory + Mini UIs

- Browse capsules: open `/memory` (the app reads `public/memory-index.json`)
- Clip mini UI: open `/ui/clip/` to scrape a URL into memory via the HTTP API

## HTTP API extras

- Grep: POST `/tool` with `{ action: "grep", pattern, file, flags }`
- Scraper: POST `/tool` with `{ action: "scrape:url"|"scrape:file", ... }` (supports `save` to memory)
- Streaming demo: GET `/stream` to see chunked JSON events of an answer

### MCP (Model Context Protocol) Server (Experimental)

A minimal MCP-style JSON-RPC 2.0 endpoint is available to expose repository knowledge to external agent clients. It now supports controlled write methods, lightweight summarization, request logging, and simple daily rate limiting.

Start the server:

```bash
(cd site && npm run -s mcp:serve -- --port 12812)
```

Optional auth:
```bash
export MCP_API_KEY="mysecret"
(cd site && MCP_API_KEY=$MCP_API_KEY npm run -s mcp:serve)
```

JSON-RPC request format:
```jsonc
{ "jsonrpc": "2.0", "id": 1, "method": "logs.list", "params": { "limit": 5 } }
```

Implemented methods:
Read:
- `logs.list { tag?, limit? }`
- `logs.get { href | path }`
- `memory.list { tag?, limit? }`
- `memory.get { id }`
- `rag.search { query, k? }`
- `health.snapshot`
- `token.ledger`
- `agent.summarize { query?, limit? }` (local RAG summarization; returns `{ summary, items[], model, degraded }`)

Write (API key required):
- `ingest.add { title?, content, tags?[] }` -> writes markdown to `logs/incoming/`
- `memory.add { title, content, tags?[], source?, summary? }` -> creates JSON capsule in `logs/memory/`

Logging & Rate Limits:
- Each request (success or error) is logged to `logs/memory/mcp/<YYYY-MM-DD>/<timestamp>-<id>.json` with a rolling `index.json` (last 500 entries) containing: `{ id, ts, method, ok, ms, paramBytes, resultBytes, error? }`.
- Daily request counter (per process) stored in `logs/memory/mcp/rate-limits.json`. Set `MCP_DAILY_REQ_LIMIT` (default 500). When exceeded, server returns JSON-RPC error `{ code: "RATE_LIMIT" }`.

Planned (future enhancement): provider-backed richer summarization (Gemini/OpenAI) using existing AI CLI logic with token ledger integration.

Example (curl):
```bash
curl -s -X POST localhost:12812/mcp \
	-H 'content-type: application/json' \
	-d '{"jsonrpc":"2.0","id":1,"method":"rag.search","params":{"query":"memory index"}}'
```

If `MCP_API_KEY` is set, include header:
```bash
	-H "x-api-key: $MCP_API_KEY"
```

Environment variables (MCP):
| Variable | Purpose | Default |
|----------|---------|---------|
| `MCP_API_KEY` | Enables auth; required for write methods | (unset) |
| `MCP_PORT` | Port to listen on | 12812 |
| `MCP_DAILY_REQ_LIMIT` | Daily request cap (read + write) | 500 |

JSON-RPC Errors (codes): `INVALID_REQUEST`, `METHOD_NOT_FOUND`, `INVALID_INPUT`, `NOT_FOUND`, `UNAUTHORIZED`, `RATE_LIMIT`, `INTERNAL`.

`agent.summarize` result shape:
```jsonc
{
	"summary": "Summary for \"recent activity\": ...",
	"items": [ { "href": "logs/2025/09/18/example", "title": "Example", "snippet": "...", "score": 0.42 } ],
	"model": "local-rag",
	"degraded": true
}
```

`degraded: true` indicates the summarization used only local TF-IDF context (no external model). A future provider-enabled path will set `degraded: false`.

