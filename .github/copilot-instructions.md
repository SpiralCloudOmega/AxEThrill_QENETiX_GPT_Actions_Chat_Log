# Copilot Instructions for AxEThrill_QENETiX_GPT_Actions_Chat_Log

This repository is a static Next.js 14 UI combined with a local-first AI toolkit for browsing and analyzing Markdown chat logs. It's deployed to GitHub Pages with automatic basePath detection.

## Project Structure

- `site/` - Next.js 14 application (App Router)
  - `app/` - Next.js pages and routes
  - `components/` - React components
  - `scripts/` - Build scripts, AI CLI, agents, and tools
  - `public/` - Static assets served at runtime
- `logs/` - Markdown log files organized by date (YYYY/MM/DD/)
  - `incoming/` - Unrouted logs awaiting processing
  - `memory/` - JSON memory capsules with metadata
- `docs/` - Additional documentation
- `.github/workflows/` - CI/CD automation including continuous agents

## Development Workflow

### Prerequisites
All commands should be run from the `site/` directory unless otherwise specified.

### Setup
```bash
cd site
npm install
```

### Development
```bash
npm run dev          # Start dev server (runs prebuild first)
npm run prebuild     # Build indices, RSS, RAG, learning policy
npm run build        # Production build
npm run export       # Export static site to out/
```

### Quality Checks
```bash
npm run lint         # ESLint (ignore pre-existing errors)
npm run tools:test   # Run tool tests (may have pre-existing failures)
```

**Note**: There are pre-existing linting errors and test failures. Focus only on not introducing new ones.

## Key Technologies

- **Next.js 14** with App Router and static export
- **TypeScript** and **React 18**
- **Marked** for Markdown parsing with highlight.js for syntax highlighting
- **TF-IDF** for local search and RAG (Retrieval-Augmented Generation)
- **Gemini/OpenAI** APIs (optional) with offline RAG fallback
- **GitHub Pages** deployment with runtime basePath detection

## Coding Standards

### TypeScript/React
- Use functional components with TypeScript
- Follow existing patterns for static generation (`generateStaticParams`)
- Use `export const dynamic = 'error'` for fully static pages
- Prefer `const` over `let` when variables aren't reassigned
- Avoid `any` types; specify proper types
- Handle empty blocks properly (don't leave them empty without comments)

### File Organization
- Server components in `app/` directories
- Client components in `components/` (use `'use client'` directive)
- Shared utilities and types alongside their usage
- Scripts in `site/scripts/` with `.mjs` extension for ES modules

### Markdown & Logs
- Log files must have a markdown heading (`# Title`)
- Tag format: `Tags: tag1, tag2, tag3` (case-insensitive, normalized)
- Logs organized by date: `logs/YYYY/MM/DD/slug.md`
- Incoming logs land in `logs/incoming/` then get routed via `route-logs.mjs`

## Important Scripts

- `scripts/prebuild.mjs` - Builds all indices before static export (logs, RSS, RAG, learning policy)
- `scripts/build-rag.mjs` - Generates TF-IDF RAG index
- `scripts/route-logs.mjs` - Routes incoming logs to dated directories
- `scripts/ai-cli.mjs` - CLI interface for AI interactions (ask, chat, RAG)
- `scripts/agents/orchestrate.mjs` - Multi-agent orchestration system
- `scripts/tools/memory.mjs` - Memory capsule management
- `scripts/tools/grep.mjs` - Safe regex search in allowlisted paths
- `scripts/tools/scraper.mjs` - Safe URL/file scraping with SSRF protection

## AI & Agents

This repo includes autonomous agents that:
- Run on schedule (continuous-agents.yml every 6 hours, monthly-agents.yml monthly)
- Process new logs and generate summaries
- Update memory capsules and indices
- Auto-commit changes back to the repository

Provider precedence: Gemini → OpenAI → local RAG (offline)

## Testing Guidelines

- Run `npm run tools:test` to verify tool functionality
- Test log routing with `npm run route:logs`
- Validate builds with `npm run build` before deploying
- Check for bundle size impact in `bundle-report.json` (generated post-build)

## Common Tasks

### Adding a new page
1. Create page in `site/app/[route]/page.tsx`
2. Use `export const dynamic = 'error'` for static pages
3. Export metadata for SEO
4. Add navigation links as needed

### Modifying log processing
1. Update parsing logic in `scripts/prebuild.mjs`
2. Regenerate indices with `npm run prebuild`
3. Test with sample logs in `logs/incoming/`

### Adding AI capabilities
1. Extend `scripts/ai-cli.mjs` for CLI features
2. Add agent roles in `scripts/agents/`
3. Update orchestrator in `scripts/agents/orchestrate.mjs`

### Working with memory capsules
1. Use `scripts/tools/memory.mjs` functions
2. Capsules stored as JSON in `logs/memory/YYYY/MM/DD/`
3. Index maintained in `scripts/public/memory-index.json`

## Deployment

- **Production**: Automatic via `.github/workflows/deploy-pages.yml` on push to main
- **Runtime config**: `site/public/ui/config.json` for tuning (related logs, search, tag aliases)
- **BasePath**: Auto-detected at runtime by inspecting `_next/` script URLs

## Security

- No secrets in logs or code (use GitHub Actions secrets)
- See `SECURITY.md` for reporting vulnerabilities
- Scraper has SSRF protection and allowlisted paths
- Grep tool restricted to allowlisted roots

## Style Preferences

- Prefer clarity over cleverness
- Add comments only when logic is non-obvious or matches existing style
- Keep functions focused and reasonably sized
- Use descriptive variable names
- Follow existing patterns in similar files

## When Making Changes

1. **Minimize modifications**: Change only what's necessary
2. **Preserve working code**: Don't refactor unless required
3. **Match existing style**: Follow patterns in nearby code
4. **Test incrementally**: Run relevant tests after each change
5. **Update docs**: If changing public APIs or behavior
6. **Ignore unrelated issues**: Focus on your specific task
