#!/usr/bin/env node
// Multi-agent orchestrator: receptionist -> planner -> frontend/backend/security/networking
// Usage:
//   node site/scripts/agents/orchestrate.mjs --spec "Short goal" [--provider=gemini|openai|rag] [--model=...] [--route]
//   node site/scripts/agents/orchestrate.mjs --file path/to/spec.md [--provider=...] [--route]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptsDir = path.resolve(__dirname, '..'); // site/scripts
const siteDir = path.resolve(scriptsDir, '..');   // site
const repoRoot = path.resolve(siteDir, '..');     // repo root
const logsDir = path.join(repoRoot, 'logs');
const incomingDir = path.join(logsDir, 'incoming');
const publicDir = path.join(siteDir, 'public');

// Lightweight providers loader (duplicated to avoid importing ai-cli main)
async function getProvider(name) {
  const prov = (name || '').toLowerCase();
  if (prov === 'gemini' || prov === 'google') {
    const { default: gem } = await import('../providers/gemini.mjs');
    return gem;
  }
  if (prov === 'openai' || prov === 'gpt' || prov === 'chatgpt') {
    const { default: oai } = await import('../providers/openai.mjs');
    return oai;
  }
  // local rag-like summarizer
  return {
    name: 'rag',
    async ask({ prompt }) {
      return `Local agent (no LLM). Prompt received:\n\n${prompt.slice(0, 4000)}`;
    }
  };
}

function nowISO() { return new Date().toISOString(); }
function ensureIncoming() { fs.mkdirSync(incomingDir, { recursive: true }); }
function slugify(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'spec'; }

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) { out[a.slice(2, eq)] = a.slice(eq + 1); }
      else { const k = a.slice(2); const n = argv[i + 1]; if (n && !n.startsWith('-')) { out[k] = n; i++; } else out[k] = true; }
    } else out._.push(a);
  }
  return out;
}

function readSpecFromFile(p) {
  const fp = path.isAbsolute(p) ? p : path.join(repoRoot, p);
  if (!fs.existsSync(fp)) throw new Error('Spec file not found: ' + p);
  return fs.readFileSync(fp, 'utf8');
}

function gatherContextSummary() {
  const bits = [];
  const idx = path.join(publicDir, 'logs-index.json');
  try {
    if (fs.existsSync(idx)) {
      const arr = JSON.parse(fs.readFileSync(idx, 'utf8'));
      bits.push(`LOGS: ${arr.length} entries`);
      bits.push('Sample: ' + arr.slice(0, 3).map(x => x.title).join(' | '));
    }
  } catch {}
  const rig = path.join(publicDir, 'rig-status.json');
  try {
    if (fs.existsSync(rig)) {
      const j = JSON.parse(fs.readFileSync(rig, 'utf8'));
      bits.push('RIG: ' + [j.os?.pretty, j.cpu?.model, j.gpu?.name].filter(Boolean).join(' | '));
    }
  } catch {}
  return bits.join('\n');
}

async function run() {
  const args = parseArgs(process.argv);
  let spec = args.spec;
  if (!spec && args.file) spec = readSpecFromFile(args.file);
  if (!spec) spec = (args._.length ? args._.join(' ') : '').trim();
  if (!spec) {
    console.log('Usage: node site/scripts/agents/orchestrate.mjs --spec "Short goal" [--provider=gemini|openai|rag] [--route]');
    process.exit(0);
  }
  const providerName = args.provider || process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : (process.env.OPENAI_API_KEY ? 'openai' : 'rag'));
  const provider = await getProvider(providerName);
  const ask = async (prompt) => provider.ask({ prompt, model: args.model });

  // Import agents
  const { default: runReceptionist } = await import('./receptionist.mjs');
  const { default: runPlanner } = await import('./planner.mjs');
  const { default: runFrontend } = await import('./frontend.mjs');
  const { default: runBackend } = await import('./backend.mjs');
  const { default: runSecurity } = await import('./security.mjs');
  const { default: runNetworking } = await import('./networking.mjs');

  const context = gatherContextSummary();

  const receptionistOut = await runReceptionist({ ask, spec });
  const plannerOut = await runPlanner({ ask, spec });
  const sharedCtx = `SPEC:\n${spec}\n\nRECEPTIONIST:\n${receptionistOut}\n\nPLANNER:\n${plannerOut}\n\nREPO CONTEXT:\n${context}`;
  const frontendOut = await runFrontend({ ask, spec, context: sharedCtx });
  const backendOut = await runBackend({ ask, spec, context: sharedCtx });
  const securityOut = await runSecurity({ ask, spec, context: sharedCtx });
  const networkingOut = await runNetworking({ ask, spec, context: sharedCtx });

  // Save markdown report
  ensureIncoming();
  const title = `Multi-agent: ${spec.slice(0, 80)}`;
  const slug = slugify(title);
  const ts = new Date();
  const stamp = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')}-${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}`;
  const fp = path.join(incomingDir, `${stamp}-${slug}.md`);
  const md = `# ${title}\n\nReceived At: ${nowISO()}\nTags: ai, agents\n\n## Input Spec\n\n${spec}\n\n## Provider\n\n${provider.name}${args.model ? ` (${args.model})` : ''}\n\n## Receptionist\n\n${receptionistOut}\n\n## Planner\n\n${plannerOut}\n\n## Frontend\n\n${frontendOut}\n\n## Backend\n\n${backendOut}\n\n## Networking\n\n${networkingOut}\n\n## Security\n\n${securityOut}\n`;
  fs.writeFileSync(fp, md);
  // Optionally route to dated folder
  if (args.route) {
    try { execSync('node scripts/route-logs.mjs', { cwd: siteDir, stdio: 'inherit' }); } catch {}
  }
  console.error(`Saved multi-agent report: ${path.relative(repoRoot, fp)}${args.route ? ' (routed)' : ''}`);
}

run().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
