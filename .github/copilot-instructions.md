# Copilot Instructions: AxEThrill QENETiX Chat Log System

## Architecture Overview

This is a **local-first AI chat log management system** with three core components:
- **`site/`**: Next.js 14 static export app with GitHub Pages deployment
- **`logs/`**: Markdown chat transcripts organized by date (`logs/YYYY/MM/DD/`)
- **`scripts/`**: Node.js automation pipeline for indexing, AI, and data processing

The system operates on a **"build-time knowledge" pattern**: all data processing happens during prebuild, generating static indexes that the client consumes.

## Key Development Patterns

### File Organization & Naming
- **Chat logs**: Follow `YYYY-MM-DD-HHMMSS-{slug}.md` format in `logs/incoming/` → routed to dated folders
- **Memory capsules**: JSON files in `logs/memory/YYYY/MM/DD/` with same timestamp pattern
- **Scripts**: All automation in `site/scripts/` with `.mjs` extension (ES modules)
- **Tools**: Reusable utilities in `site/scripts/tools/` (memory, grep, scraper, etc.)

### Critical Build Pipeline
The prebuild sequence is **order-dependent**:
1. `npm run prebuild` → `scripts/prebuild.mjs` (generates logs-index.json, RSS, commit graph)
2. `npm run build` → Next.js build with static export
3. `npm run postbuild` → `scripts/bundle-report.mjs` (generates bundle-report.json)

**Never skip prebuild** - the UI depends on generated indexes in `public/`.

### Tag System & Normalization
Tags follow strict normalization via `scripts/lib/tags.mjs`:
- Lowercased, whitespace collapsed, trailing punctuation stripped
- Alias mapping through `public/ui/config.json` → `tagAliases`
- Applied consistently across logs, memory, and RAG indexing

Example alias config:
```json
{ "tagAliases": { "nvidia code:": "nvidia", "gpt actions": "actions" } }
```

### AI Provider Pattern
The system supports **graceful degradation** across providers:
1. Gemini (`GEMINI_API_KEY`) → preferred
2. OpenAI (`OPENAI_API_KEY`) → fallback
3. RAG-only (`rag`) → offline mode

Set via `AI_PROVIDER=gemini|openai|rag` or `AI_PROVIDER_FORCE` in CI.

### Memory System Architecture
**Memory capsules** are immutable JSON documents with structure:
```javascript
{
  id: "2025-09-20-143022-topic-slug",
  ts: "2025-09-20T14:30:22.123Z",
  title: "Human readable title",
  tags: ["normalized", "tags"],
  source: "URL or file path",
  summary: "Brief description (2000 chars max)",
  content: "Full content (10000 chars max)",
  data: null // Optional structured data
}
```

Access via `scripts/tools/memory.mjs`: `addMemory()`, `listMemory()`, `searchMemory()`.

## Development Workflow

### Local Development
```bash
cd site
npm run prebuild  # Generate indexes first
npm run dev       # Start dev server
```

### Adding New Scripts
1. Create in `site/scripts/` with `.mjs` extension
2. Add npm script in `package.json`
3. Follow error handling pattern: `try/catch` with `process.exit(1)` on failure
4. Use absolute paths via `fileURLToPath(import.meta.url)` resolution

### Working with Logs
- **New logs**: Save to `logs/incoming/` → run `npm run route:logs` to organize
- **Frontmatter**: Support YAML-like `---` blocks with `title:`, `tags:`, `date:`
- **Parsing**: Use `parseHeader()` from `prebuild.mjs` for consistent extraction

### Testing & Validation
- **Tools test**: `npm run tools:test` - validates memory, grep, scraper functions
- **MCP test**: `npm run test:mcp` - validates JSON-RPC server
- **Lint**: `npm run lint` with TypeScript ESLint rules

## GitHub Actions Integration

### Continuous Agents (`continuous-agents.yml`)
- Triggers on `logs/**/*.md` changes every 6 hours
- **Batch guard**: Skips if estimated tokens > `BATCH_GUARD_LIMIT * 1000` (default 150k)
- **State tracking**: `logs/memory/agent-state/continuous-state.json`
- Auto-commits with `[agents]` prefix

### Pages Deployment (`deploy-pages.yml`)
- Triggers on `site/**` or `logs/**` changes
- **Critical**: Sets `GITHUB_ACTIONS=true` for proper `basePath` detection
- **Dependencies**: Must run prebuild before build/export

## Common Issues & Solutions

### GitHub Pages basePath
Next.js auto-detects repository name for GitHub Pages via:
```javascript
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const basePath = isPages ? `/${repo}` : '';
```
Never hardcode paths - use Next.js `basePath` in `next.config.js`.

### RAG Index Corruption
If TF-IDF search breaks:
```bash
cd site
npm run rag:build  # Rebuild from scratch
npm run prebuild   # Regenerate all indexes
```

### Memory Index Issues
Memory UI depends on `scripts/public/memory-index.json`:
```bash
cd site
node -e "require('./scripts/tools/memory.mjs').buildMemoryIndex()"
```

### Tag Inconsistencies
After updating `tagAliases` in `public/ui/config.json`:
```bash
npm run prebuild  # Reprocess all tags through aliases
```

## File Path Conventions

- **Always use absolute paths** in scripts via `path.resolve()`
- **ESM imports**: Use `fileURLToPath(import.meta.url)` for `__dirname` equivalent
- **Cross-platform**: Use `path.join()` not string concatenation
- **Public assets**: Generated files go in `site/public/` for client access

## AI Tool Integration

The system provides **controlled AI tool access** via:
- **Safe grep**: `tools/grep.mjs` with allowlisted directories
- **Safe scraper**: `tools/scraper.mjs` with SSRF protection
- **Memory tools**: Structured storage with search capabilities
- **MCP server**: JSON-RPC interface for external AI systems

When extending AI capabilities, maintain the **safety-first** pattern with input validation and resource limits.