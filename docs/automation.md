# Automation & Agent Orchestration

This document outlines the autonomous processing pipeline for the Chat Log system: ingestion, indexing, RAG + memory updates, agents, and deployment workflows.

## Components

- **Static Site (Next.js 14)**: Exported via `npm run build` into `out/` and served by Nginx (multi-stage Dockerfile).
- **Logs & Memory**: Markdown logs under `logs/YYYY/MM/DD/*.md`, memory capsules under `public/memory/` with index metadata in `scripts/public/memory-index.json`.
- **RAG Index**: Generated (TF-IDF) + PNG capsule artifact `public/rag-index.json` & `public/rag-capsule.png`.
- **Agents**: Modular scripts in `site/scripts/agents/` (planner/orchestrator/role-specific). Continuous vs monthly depth runs.
- **Provider Selection**: Prefers Gemini > OpenAI > local RAG fallback unless `AI_PROVIDER_FORCE` is set.

## Workflows Overview

### Continuous Agents
Located at `.github/workflows/continuous-agents.yml`.

Runs on:
- Push (changed logs markdown)
- Scheduled (every 6 hours)
- Manual dispatch

Key features:
- Provider detection + override (`AI_PROVIDER_FORCE`)
- Change analysis (new/modified logs only)
- Approx token estimation: `approxTokens = Math.round(chars / 4)`
- Batch guard: skips run if changed-token load exceeds `BATCH_GUARD_LIMIT` (default 150 * 1k tokens equivalent heuristic)
- State file: `logs/memory/agent-state/continuous-state.json` (stores last processed commit & stats)
- Conditional agent execution (`SKIP_RUN` environment flag when guard trips)
- Auto commits memory/index updates back to repo

### Monthly Agents
Located at `.github/workflows/monthly-agents.yml`.

Runs on schedule for deeper summarization / consolidation.

Differences vs continuous:
- Larger scope (may reprocess broader slices)
- Soft-fail strategy (won't block other automations)
- Could be aligned to Gemini-first precedence (optional future sync)

## Ingestion

Script: `site/scripts/ingest.mjs`

Usage examples:
```
node site/scripts/ingest.mjs ./external-logs
node site/scripts/ingest.mjs docs/**/*.md --tags research,planning
node site/scripts/ingest.mjs notes/today.md --tags quick
```
Features:
- Accepts file, directory, or glob
- Ensures a title (first markdown heading or injects one based on filename)
- Optional frontmatter with tags
- Writes imported files to `logs/incoming/` (date-intact if parseable)
- Skips binary / non-markdown

Post-ingestion: Let continuous agents pick up the new files (or trigger workflow_dispatch) to integrate into memory & RAG.

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI provider key | (unset) |
| `GEMINI_API_KEY` | Gemini provider key | (unset) |
| `AI_PROVIDER_FORCE` | Force provider: `gemini`, `openai`, or `rag` | (auto detect) |
| `BATCH_GUARD_LIMIT` | Upper token (k) heuristic threshold before skipping | 150 |

Heuristic: The workflow computes `approxTokens` ~ `chars / 4`; if `approxTokens > BATCH_GUARD_LIMIT * 1000`, the run is skipped to avoid runaway usage.

## State & Safety

- State JSON stores last processed commit: prevents redundant full reprocessing.
- Batch guard prevents unexpectedly large commits (e.g., bulk import) from triggering huge token spend in a single run. After manual review, you can re-run with a higher limit: `BATCH_GUARD_LIMIT=500` in workflow_dispatch.
- Provider fallback ensures functionality even with missing external keys.

## Docker Architecture

Multi-stage `Dockerfile` targets:
- `build`: Installs dependencies & builds/export static site.
- `web`: Nginx serving exported `out/`.
- `agent`: Node image with scripts for orchestrated runs.

Compose services (`docker-compose.yml`):
- `build`: Utility container (idle) with mounted volumes for logs/public (optional dev operations)
- `web`: Serves static site on host port 3000
- `agent`: Runs orchestrator continuously (override command as needed)

Volumes (bind mounts):
- `./logs` for log ingestion + updates
- `./public` for generated artifacts (indices, health, memory)

## Local Dev / Quick Start

```
# Build images
docker compose build
# Start web + agent
OPENAI_API_KEY=... GEMINI_API_KEY=... docker compose up -d
# Tail agent logs
docker compose logs -f agent
```

To manually trigger ingestion locally then allow agent loop to process:
```
node site/scripts/ingest.mjs ./bulk-import --tags backlog
```

Rebuild static site locally outside of CI:
```
cd site
node scripts/prebuild.mjs
npm run build
```
The exported site is in `site/out/`.

## Extending Agents

Add new role script under `site/scripts/agents/` and reference it in `orchestrate.mjs`. Implement capability detection & cost guards similar to existing roles. For advanced orchestration consider adding:
- Token budget ledger file
- Semantic diff clustering for large batches
- MCP integration (future): adapter layer mapping memory & log corpus to MCP resource capabilities

## Future Enhancements (Backlog)

- Align monthly workflow provider precedence with continuous (Gemini-first)
- Add tests for ingestion edge cases (duplicate titles, frontmatter conflict)
- Implement per-tag memory summarization
- Introduce token usage ledger & quota enforcement
- Add MCP server for external tool calling and resource introspection
- Integrate vector embeddings (hybrid lexical + semantic) as optional RAG mode

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Continuous workflow skipped | Batch guard exceeded | Re-run with higher `BATCH_GUARD_LIMIT` or split commit |
| Provider shows `rag` only | No API keys detected | Set `GEMINI_API_KEY` or `OPENAI_API_KEY` |
| Missing new logs on site | Static export stale | Re-run build or wait for deploy workflow |
| Memory index not updating | Agent skipped or failed early | Check workflow logs after provider detection step |

## License & Security

See `SECURITY.md` for reporting. Ensure secrets only added via repository settings / GitHub Actions secrets. Avoid committing raw API keys to logs.

---
Feel free to refine or extend this doc as the automation surface evolves.
