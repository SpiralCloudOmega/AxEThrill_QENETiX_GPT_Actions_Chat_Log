#!/usr/bin/env node
// Agent Zero: prompt-only multi-step graph runner (Gemini-first, works with OpenAI or local fallback)
// Usage:
//   node site/scripts/agents/agent-zero.mjs --spec "Short goal" [--provider=openai|rag] [--model=...] [--route]
//   node site/scripts/agents/agent-zero.mjs --file logs/inbox/spec.md [--graph '{"nodes":[...]}'] [--route]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptsDir = path.resolve(__dirname, '..'); // site/scripts
const siteDir = path.resolve(scriptsDir, '..');   // site
const repoRoot = path.resolve(siteDir, '..');     // repo root
const logsDir = path.join(repoRoot, 'logs');
const incomingDir = path.join(logsDir, 'incoming');

function ensureIncoming() { fs.mkdirSync(incomingDir, { recursive: true }); }
function nowISO() { return new Date().toISOString(); }
function slugify(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80) || 'agent-zero'; }
function parseArgs(argv){ const out={_:[]}; for(let i=2;i<argv.length;i++){const a=argv[i]; if(a.startsWith('--')){const eq=a.indexOf('='); if(eq!==-1){out[a.slice(2,eq)]=a.slice(eq+1);}else{const k=a.slice(2); const n=argv[i+1]; if(n && !n.startsWith('-')){out[k]=n; i++;} else out[k]=true;}} else out._.push(a);} return out; }

async function getProvider(name){
  const prov=(name||'').toLowerCase();
  
  if(prov==='openai'||prov==='gpt'||prov==='chatgpt'){ const { default: oai } = await import('../providers/openai.mjs'); return oai; }
  return { name:'rag', async ask({ prompt }){ return `Local agent (no LLM). Prompt received:\n\n${prompt.slice(0,4000)}`; } };
}

function readSpecFromFile(p){ const fp=path.isAbsolute(p)?p:path.join(repoRoot,p); if(!fs.existsSync(fp)) throw new Error('Spec file not found: '+p); return fs.readFileSync(fp,'utf8'); }

function defaultGraph(){
  return {
    nodes: [
      { id:'understand', role:'Analyst', prompt:'Restate the goal clearly in 1-3 sentences and list key constraints and assumptions.' },
      { id:'plan', role:'Planner', inputs:['understand'], prompt:'Propose a concise step-by-step plan (3-7 steps). Keep it actionable and minimal.' },
      { id:'solve', role:'Builder', inputs:['plan'], prompt:'Produce the deliverable (text/design/spec/code-plan) based on the plan. Keep it self-contained and runnable if applicable.' },
      { id:'critique', role:'Critic', inputs:['solve'], prompt:'Critique the solution. List 3-5 risks or gaps and concrete fixes. Be specific.' },
      { id:'final', role:'Presenter', inputs:['solve','critique'], prompt:'Refine the solution by applying the key improvements. Output the final answer only.' }
    ]
  };
}

function parseGraph(graphArg){
  if(!graphArg) return defaultGraph();
  try { return JSON.parse(graphArg); } catch {}
  // If graphArg is a path to a JSON file
  try { const p=path.isAbsolute(graphArg)?graphArg:path.join(repoRoot,graphArg); const txt=fs.readFileSync(p,'utf8'); return JSON.parse(txt); }
  catch { return defaultGraph(); }
}

function buildNodePrompt(node, spec, results){
  const role = node.role ? `You are the ${node.role}.` : 'You are an expert agent.';
  const ctx = (node.inputs||[]).map(id => results[id] ? `\n\n[${id.toUpperCase()}]\n${results[id]}` : '').join('');
  return `${role} Follow the instructions precisely.

SPEC:
${spec}
${ctx}

TASK:
${node.prompt}

Format your answer in clear markdown.`;
}

async function run(){
  const args = parseArgs(process.argv);
  const spec = args.spec || (args.file ? readSpecFromFile(args.file) : (args._.length ? args._.join(' ') : ''));
  if(!spec){
    console.log('Usage: node site/scripts/agents/agent-zero.mjs --spec "Short goal" [--provider=openai|rag] [--graph JSON|file] [--route]');
    process.exit(0);
  }
  const providerName = args.provider || process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'rag');
  const provider = await getProvider(providerName);
  const ask = async (prompt) => provider.ask({ prompt, model: args.model });
  const graph = parseGraph(args.graph);
  const results = {};
  const order = graph.nodes || [];
  for(const node of order){
    const prompt = buildNodePrompt(node, spec, results);
    const out = await ask(prompt);
    results[node.id] = out || '';
  }
  // Save markdown report
  ensureIncoming();
  const title = `Agent Zero: ${spec.slice(0,80)}`;
  const slug = slugify(title);
  const ts = new Date();
  const stamp = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')}-${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}`;
  const fp = path.join(incomingDir, `${stamp}-${slug}.md`);
  let md = `# ${title}\n\nReceived At: ${nowISO()}\nTags: ai, agents\n\n## Input Spec\n\n${spec}\n\n## Provider\n\n${provider.name}${args.model ? ` (${args.model})` : ''}\n`;
  for(const node of order){
    md += `\n## ${node.role || 'Agent'} — ${node.id}\n\n${results[node.id] || ''}\n`;
  }
  fs.writeFileSync(fp, md);
  if (args.route) { try { execSync('node scripts/route-logs.mjs', { cwd: siteDir, stdio: 'inherit' }); } catch {} }
  console.error(`Saved Agent Zero report: ${path.relative(repoRoot, fp)}${args.route ? ' (routed)' : ''}`);
}

run().catch((e)=>{ console.error(e?.stack||String(e)); process.exit(1); });
