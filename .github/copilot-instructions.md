# GitHub Copilot Instructions

This repository is a **Next.js 14 static site + local-first AI toolkit** for browsing and analyzing Markdown chat logs, deployed to GitHub Pages. It includes autonomous agents, RAG indexing, memory capsules, and AI CLI tools.

## Tech Stack

- **Framework**: Next.js 14 (App Router, static export)
- **Language**: TypeScript + JavaScript (ESM modules)
- **Styling**: CSS Modules and global CSS
- **AI Providers**: Optional Gemini/OpenAI, with offline RAG fallback
- **Build Tools**: Node.js 20+, npm
- **Deployment**: GitHub Pages (automated via `.github/workflows/deploy-pages.yml`)

## Project Structure

```
/
├── .github/              # Workflows, issue/PR templates
├── docs/                 # Documentation (automation.md)
├── logs/                 # Markdown chat logs (YYYY/MM/DD/*.md)
├── site/                 # Next.js application
│   ├── app/              # App Router pages (page.tsx, layout.tsx)
│   ├── components/       # React components
│   ├── scripts/          # Build scripts, AI CLI, agents
│   │   ├── agents/       # Multi-agent orchestration
│   │   ├── tools/        # Memory, grep, scraper utilities
│   │   └── providers/    # Gemini/OpenAI provider adapters
│   ├── public/           # Static assets, generated indexes
│   ├── package.json      # npm scripts and dependencies
│   ├── tsconfig.json     # TypeScript configuration
│   └── .eslintrc.cjs     # ESLint configuration
└── README.md             # Main documentation
```

## Development Workflow

### Setup
```bash
cd site
npm install
npm run prebuild    # Generate indexes, RAG, feeds
npm run dev         # Start dev server
```

### Key Commands
- **Build**: `npm run build` (includes prebuild, typecheck optional, postbuild report)
- **Prebuild**: `npm run prebuild` (generate logs-index.json, rag-index.json, learn-policy.json, RSS, etc.)
- **Lint**: `npm run lint` (ESLint for JS/MJS/TS/TSX files)
- **Test**: `npm run tools:test` (run tools unit tests)
- **AI CLI**: `npm run ai:ask -- "question"`, `npm run ai:chat`, `npm run ai:rag`
- **Agents**: `npm run ai:agents -- "spec"` (orchestrated agents), `npm run ai:agent-zero -- "spec"` (prompt-only graph)

### Testing
- Run `npm run tools:test` from `site/` for tool tests
- Check `npm run test:ledger` for ledger tests
- CI runs: typecheck (no dedicated script, via tsc), lint, build, tools:test

## Code Style Guidelines

### TypeScript/JavaScript
- Use **ESM** (`import`/`export`) for all modules (`.mjs`, `.ts`, `.tsx`)
- **Prefer `const`** over `let` when values don't change
- Use **TypeScript** for React components (`.tsx`) and prefer typed interfaces
- Avoid `any` types; use specific types or `unknown` when necessary
- Follow naming: `camelCase` for variables/functions, `PascalCase` for components/classes
- Use **async/await** for asynchronous operations
- Unused variables should be prefixed with `_` (e.g., `_unused`)

### ESLint Rules
- `no-unused-vars`: warn (ignored if prefixed with `_`)
- `prefer-const`: warn
- `no-var`: error
- `@typescript-eslint/no-explicit-any`: error (in TS files)
- Empty blocks (`no-empty`): error

### React/Next.js Patterns
- Use **App Router** conventions (`app/` directory)
- Server Components by default; add `'use client'` only when needed (hooks, browser APIs)
- Use `page.tsx` for routes, `layout.tsx` for layouts
- Static exports: all pages must be statically exportable (no runtime server features)
- Base path auto-detection: runtime uses `/_next/` script URL inspection

### File Organization
- Components in `site/components/` or colocated with pages
- Scripts in `site/scripts/` (build scripts, AI CLI, agents)
- Public assets in `site/public/` (generated indexes land here)
- Logs in `logs/YYYY/MM/DD/*.md` (frontmatter with title, tags, date)

## Common Patterns

### AI Provider Selection
Precedence (can be overridden):
1. `GEMINI_API_KEY` → `gemini`
2. `OPENAI_API_KEY` → `openai`
3. Fallback → `rag` (offline TF-IDF)

Use `AI_PROVIDER=<provider>` locally, `AI_PROVIDER_FORCE=<provider>` in workflows.

### Memory Capsules
- Store in `logs/memory/*.json` (title, content, tags, source)
- Build index: `npm run -s --prefix site ai:inbox:once` or via tools
- Tools: `memory.mjs` exports `addMemory`, `buildMemoryIndex`, `listMemory`, `searchMemory`

### Tags & Normalization
- Lowercased, whitespace collapsed, trailing punctuation stripped
- Aliases in `site/public/ui/config.json` → `tagAliases`
- Run `npm run prebuild` to propagate changes

### RAG & Search
- TF-IDF index in `site/public/rag-index.json`
- PNG capsule in `site/public/rag-capsule.png` (steganographic backup)
- Offline search works without API keys

### Agents
- **Orchestrator**: `site/scripts/agents/orchestrate.mjs` (receptionist → planner → frontend/backend/security/networking)
- **Agent Zero**: `site/scripts/agents/agent-zero.mjs` (prompt-only graph, no code execution)
- Both output to `logs/incoming/`, use `npm run route:logs` to move to dated folders

## Build & CI

### Prebuild Steps
1. Generate `logs-index.json` (all logs metadata)
2. Build `rag-index.json` + `rag-capsule.png` (TF-IDF vectors)
3. Generate `learn-policy.json` (tag co-occurrence suggestions)
4. Build `memory-index.json` (memory capsules metadata)
5. Generate RSS feeds, commit graph, repo tree JSON
6. Emit `health.json` (snapshot: logs count, tags, RAG stats, commit info)

### GitHub Pages Deployment
- Triggered by push to `main` (`.github/workflows/deploy-pages.yml`)
- Steps: install deps → prebuild → build → export → deploy `site/out/`
- Base path: auto-detected at runtime (no env var needed)
- Visit: `https://<owner>.github.io/<repo>/`

### Continuous Agents
- **Workflow**: `.github/workflows/continuous-agents.yml`
- **Trigger**: every 6 hours, on push (logs changes), manual dispatch
- **Features**:
  - Batch guard (skip if token estimate > 150k)
  - State checkpoint (`logs/memory/agent-state/continuous-state.json`)
  - Auto-commits memory/index updates
- **Safety**: token usage caps, allowlisted file roots, SSRF protection

## Contributing Guidelines

### Before Submitting
1. Run `npm run lint` from `site/` (fix errors, warnings are acceptable)
2. Run `npm run build` to ensure static export succeeds
3. Run `npm run tools:test` to validate tool utilities
4. Check PR template checklist (`.github/pull_request_template.md`)

### PR Best Practices
- **Title**: clear, descriptive (e.g., "Add memory search pagination")
- **Description**: explain "Why" not just "What", include steps to test
- **Size**: keep PRs focused and small when possible
- **Tests**: add/update tests for new features or bug fixes
- **Docs**: update README.md or docs/ if behavior changes
- **No secrets**: never commit API keys or sensitive data

### Issue Templates
- **Bug Report**: `.github/ISSUE_TEMPLATE/bug_report.md`
- **Feature Request**: `.github/ISSUE_TEMPLATE/feature_request.md`

### Code Review
- CODEOWNERS: add `.github/CODEOWNERS` to auto-request reviews
- Address feedback promptly, mark resolved threads
- Squash/rebase before merge if needed

## Security

### Safe Operations
- **Grep**: allowlisted roots (`logs/`, `site/public/`)
- **Scraper**: SSRF guard (blocks localhost, private IPs, link-local)
- **FS operations**: restricted to allowlisted directories
- **Agent execution**: no arbitrary code execution in Agent Zero (prompt-only)

### Reporting Vulnerabilities
See `SECURITY.md`: open security advisory or email owner, no public issues.

## Additional Resources

- **README.md**: Full feature list, setup, deployment guide
- **docs/automation.md**: Deep dive on agents, workflows, and orchestration
- **site/app/help/page.tsx**: In-app help page with Git/GitHub tips
- **site/app/ai/page.tsx**: AI CLI and agent documentation

## Quick Tips

- **Logs structure**: `logs/YYYY/MM/DD/*.md` with frontmatter (title, tags, date)
- **Incoming logs**: land in `logs/incoming/`, use `npm run route:logs` to move
- **Theme**: System/Light/Dark toggle (sets `data-theme` on `<html>`)
- **Search**: Client-side TF-IDF with tag filtering
- **Related logs**: Cosine similarity + Jaccard tag overlap
- **Prebuild required**: after adding logs, tags, or config changes
- **Bundle report**: `site/public/bundle-report.json` after build
- **Health endpoint**: `/health` page or `/health.json` for monitoring
