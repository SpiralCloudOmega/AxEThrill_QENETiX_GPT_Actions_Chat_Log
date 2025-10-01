# GitHub Copilot Instructions for AxEThrill_QENETiX_GPT_Actions_Chat_Log

## Project Overview

This is a static Next.js 14 site with a local-first AI toolkit for browsing and analyzing Markdown chat logs. The site is deployed to GitHub Pages and auto-detects the base path at runtime.

**Key Technologies:**
- Next.js 14 (App Router)
- TypeScript/React
- TF-IDF RAG (Retrieval Augmented Generation)
- Optional AI providers: Gemini, OpenAI
- Static site generation with `next export`

## Project Structure

```
.
├── site/                      # Next.js application
│   ├── app/                   # App Router pages
│   ├── components/            # React components
│   ├── scripts/               # Build and utility scripts
│   │   ├── prebuild.mjs      # Generates indexes, feeds, RAG
│   │   ├── ai-cli.mjs        # Local AI CLI
│   │   ├── build-rag.mjs     # Build TF-IDF RAG index
│   │   ├── providers/        # AI provider adapters
│   │   └── tools/            # Memory, grep, scraper tools
│   ├── public/                # Static assets
│   └── package.json
├── logs/                      # Markdown chat logs (YYYY/MM/DD/)
│   ├── incoming/             # New logs before routing
│   └── memory/               # JSON memory capsules
├── .github/
│   ├── workflows/            # CI/CD workflows
│   └── ISSUE_TEMPLATE/       # Issue templates
└── README.md
```

## Development Workflow

### Setup
```bash
cd site
npm ci                    # Install dependencies
npm run prebuild         # Generate indexes
npm run dev              # Start dev server
```

### Build & Test
```bash
cd site
npm run typecheck        # TypeScript checks
npm run lint             # ESLint
npm run build            # Build static site
npm run tools:test       # Run tools tests
```

### Key Scripts (from site/)
- `npm run prebuild` — Generate logs index, RSS, RAG, memory index
- `npm run save:chat` — Save new chat log interactively
- `npm run route:logs` — Route incoming logs to dated folders
- `npm run ai:ask -- "question"` — Ask with RAG context
- `npm run ai:chat` — Interactive chat session
- `npm run ai:serve` — Start local HTTP API

## Code Style & Conventions

### JavaScript/TypeScript
- Use modern ES2023+ syntax
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Async/await for promises
- No semicolons (project style)
- Use `?.` optional chaining
- Underscore prefix for unused variables (`_param`)

### React/Next.js
- Use App Router (not Pages Router)
- Client components: `"use client"` directive
- Server components by default
- Use `next/link` for navigation
- Dynamic imports for code splitting
- TypeScript for all new components

### File Naming
- React components: PascalCase (`RelatedLogs.tsx`)
- Scripts: kebab-case (`build-rag.mjs`)
- Utilities: camelCase functions
- Logs: YYYY/MM/DD structure

## Testing

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Tools test: `npm run tools:test`
- Ledger test: `npm run test:ledger`
- Ingest edge test: `npm run test:ingest-edge`

## AI Features

### Providers
1. **Gemini** (preferred): Set `GEMINI_API_KEY`
2. **OpenAI**: Set `OPENAI_API_KEY`
3. **RAG** (offline): No API key needed

### RAG System
- TF-IDF based retrieval from logs
- Cosine similarity ranking
- Tag-aware boosting (configurable)
- PNG capsule embedding for data portability

## Important Files

### Configuration
- `site/next.config.js` — Next.js config (basePath detection)
- `site/public/ui/config.json` — Runtime UI config (tag aliases, related logs settings)
- `site/.eslintrc.cjs` — Linting rules
- `site/tsconfig.json` — TypeScript config

### Build Outputs
- `site/public/logs-index.json` — Main logs index
- `site/public/memory-index.json` — Memory capsules index
- `site/public/rag-capsule.png` — RAG data embedded in PNG
- `site/public/health.json` — Build health snapshot
- `site/public/bundle-report.json` — Bundle size report

## Deployment

- **Main branch** → Automatic GitHub Pages deploy
- **Workflow**: `.github/workflows/deploy-pages.yml`
- **Process**: prebuild → build → export → deploy
- **URL**: `https://SpiralCloudOmega.github.io/AxEThrill_QENETiX_GPT_Actions_Chat_Log/`

## Automated Agents

### Continuous Agents
- Runs every 6 hours and on logs changes
- Auto-summarizes with AI providers
- Batch guard: skips if >150k estimated tokens
- Workflow: `.github/workflows/continuous-agents.yml`

### Monthly Agents
- Deeper analysis monthly
- Workflow: `.github/workflows/monthly-agents.yml`

## Best Practices

### When Adding Features
1. Keep changes minimal and focused
2. Update types in TypeScript files
3. Test locally with `npm run dev`
4. Run typecheck and lint before committing
5. Update README.md if adding new scripts
6. Ensure static export still works (`npm run build && npm run export`)

### When Working with Logs
- Store in `logs/YYYY/MM/DD/` structure
- Include frontmatter (title, tags, date, id)
- Use `npm run route:logs` to organize incoming logs
- Tags are normalized (lowercase, whitespace collapsed)
- Tag aliases in `site/public/ui/config.json`

### When Modifying Scripts
- Keep Node.js scripts in ESM format (`.mjs`)
- Use `#!/usr/bin/env node` shebang
- Handle errors gracefully
- Log progress for long operations
- Document CLI options in help text

### When Working with Components
- Server components by default
- Use `"use client"` only when needed (hooks, events, browser APIs)
- Prefer composition over inheritance
- Keep components focused and single-purpose
- Use TypeScript interfaces for props

### Security Considerations
- Grep tool: allowlisted roots only
- Scraper: SSRF guard for URLs
- No secrets in code (use environment variables)
- Validate user inputs in tools
- Safe regex patterns only

## Common Patterns

### Adding a New Page
```tsx
// site/app/newpage/page.tsx
export default function NewPage() {
  return (
    <div>
      <h2>Page Title</h2>
      <p>Content...</p>
    </div>
  );
}
```

### Creating a Build Script
```javascript
#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
// Script logic...
```

### Using the RAG System
```javascript
import { cosineRank, loadRagIndex } from './scripts/ai-cli.mjs';
const rag = loadRagIndex();
const results = cosineRank(rag, "query", 6);
```

## Troubleshooting

### Build Failures
- Check Node.js version (v20+)
- Clear `.next/` and `out/` directories
- Run `npm ci` to reinstall deps
- Check for TypeScript errors with `npm run typecheck`

### Missing Indexes
- Run `npm run prebuild` to regenerate
- Ensure logs exist in `logs/` directory
- Check prebuild script output for errors

### GitHub Pages 404
- Verify `out/` directory exists after export
- Check basePath detection in `next.config.js`
- Ensure workflow has Pages permissions

## Git Workflow

### Branch Naming
- Feature: `feature/description`
- Fix: `fix/description`
- Copilot fixes: `copilot/fix-{uuid}`

### Commit Messages
- Use conventional format: `type: description`
- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`
- Keep first line under 72 characters
- Add body for complex changes

### PR Guidelines
- Include "Why" not just "What"
- Add testing steps
- Update docs if needed
- Reference related issues

## Environment Variables

### Development
- `AI_PROVIDER` — Force provider (gemini|openai|rag)
- `GEMINI_API_KEY` — Gemini API key
- `OPENAI_API_KEY` — OpenAI API key
- `GEMINI_MODEL` — Override default model
- `OPENAI_MODEL` — Override default model

### CI/CD
- `AI_PROVIDER_FORCE` — Force provider in workflows
- `BATCH_GUARD_LIMIT` — Token limit (default: 150)
- `MCP_API_KEY` — MCP server authentication

## Additional Resources

- **Main README**: `/README.md`
- **Automation Guide**: `/docs/automation.md`
- **Help Page**: `/help` (in deployed site)
- **Issue Templates**: `.github/ISSUE_TEMPLATE/`
- **PR Template**: `.github/pull_request_template.md`

## Tips for Copilot

- When suggesting code, match the existing style (no semicolons, arrow functions)
- Prefer server components unless client-side features are needed
- Use existing utility functions from scripts before creating new ones
- Consider static generation requirements (no runtime server dependencies)
- Test suggestions work with `next export` (no dynamic API routes)
- Keep bundle size in mind (check `bundle-report.json`)
- Preserve existing tag normalization and alias logic
- Use typed interfaces for better suggestions
