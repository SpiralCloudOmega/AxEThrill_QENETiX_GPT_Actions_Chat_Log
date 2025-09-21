#!/usr/bin/env node
// A local-first AI CLI with optional cloud providers (OpenAI) and offline RAG.
// Commands:
//  - ask: one-shot Q&A
//  - chat: interactive session
//  - rag: retrieve-only from local TF-IDF index
//  - serve: lightweight JSON server for /ask and /rag
// Transcripts are saved to logs/incoming and can be routed with route-logs.mjs.

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { analyzeFile } from './tools/analyze.mjs';
import { execJS } from './tools/exec-js.mjs';
import { grepText } from './tools/grep.mjs';
import { execShell } from './tools/sh.mjs';
import { addMemory, buildMemoryIndex, listMemory, searchMemory } from './tools/memory.mjs';
import { scrapeUrl, scrapeFile, makeMemoryFromScrape } from './tools/scraper.mjs';

// Resolve siteDir relative to this file, not process.cwd()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.join(siteDir, '..');
const logsDir = path.join(repoRoot, 'logs');
const incomingDir = path.join(logsDir, 'incoming');
const publicDir = path.join(siteDir, 'public');
const uiRoot = path.join(publicDir, 'ui');

// --------- Small utilities
function nowISO() { return new Date().toISOString(); }
function ensureDirs() { fs.mkdirSync(incomingDir, { recursive: true }); }
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'chat';
}

// Save transcript as a markdown log in logs/incoming
function saveTranscript({ title, messages, tags = [] }) {
  ensureDirs();
  const ts = new Date();
  const yyyy = String(ts.getFullYear());
  const mm = String(ts.getMonth() + 1).padStart(2, '0');
  const dd = String(ts.getDate()).padStart(2, '0');
  const stamp = `${yyyy}-${mm}-${dd}-${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`;
  const fileTitle = slugify(title || messages.find(m => m.role === 'user')?.content || 'chat');
  const fname = `${stamp}-${fileTitle}.md`;
  const p = path.join(incomingDir, fname);
  const tagLine = tags.length ? `\nTags: ${tags.join(', ')}` : '';
  const header = `# ${title || 'Chat Transcript'}\n\nReceived At: ${nowISO()}${tagLine}\n\n`;
  const body = messages.map(m => `**${m.role.toUpperCase()}**: ${m.content}`).join('\n\n');
  fs.writeFileSync(p, header + body + '\n');
  return p;
}

// --------- RAG: load and query local TF-IDF index
const STOP = new Set('the,of,and,to,in,a,for,is,that,on,with,as,it,by,from,at,be,an,or,are,this,was,will,can,not,have,has,had,if,then,else,do,does,did,than,which,into,over,under,between,within,without,about,after,before,since,per,each,via'.split(','));
function tokenize(text) { return (text.toLowerCase().match(/[a-z0-9_]+/g) || []).filter(t => t.length > 1 && !STOP.has(t)); }

function loadRagIndex() {
  const ragPath = path.join(publicDir, 'rag-index.json');
  if (!fs.existsSync(ragPath)) return null;
  try { return JSON.parse(fs.readFileSync(ragPath, 'utf8')); } catch { return null; }
}

function buildQueryVector(q, idf) {
  const toks = tokenize(q);
  const tf = new Map();
  for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
  const vec = [];
  let sumsq = 0;
  for (const [t, f] of tf) {
    const w = f * (idf[t] || 1);
    if (w > 0) { vec.push([t, w]); sumsq += w * w; }
  }
  const norm = Math.sqrt(sumsq) || 1;
  return { vec, norm };
}

function cosineRank(rag, q, topK = 6) {
  if (!rag?.chunks?.length) return [];
  const { vec, norm } = buildQueryVector(q, rag.idf || {});
  const scores = [];
  const qWeights = Object.fromEntries(vec);
  for (let i = 0; i < rag.chunks.length; i++) {
    const c = rag.chunks[i];
    let dot = 0;
    for (const [t, w] of c.vector) {
      const qw = qWeights[t];
      if (qw) dot += w * qw;
    }
    const denom = (c.norm || 1) * norm;
    const score = denom ? dot / denom : 0;
    if (score > 0) scores.push([i, score]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  return scores.slice(0, topK).map(([i, s]) => ({ score: s, ...rag.chunks[i] }));
}

// --------- Providers (loaded dynamically)
async function getProvider(name) {
  const prov = (name || '').toLowerCase();
  if (prov === 'openai' || prov === 'gpt' || prov === 'chatgpt') {
    try {
      const { default: oai } = await import('./providers/openai.mjs');
      return oai;
    } catch (e) {
      throw new Error('OpenAI provider not available. Install openai and set OPENAI_API_KEY. ' + (e?.message || e));
    }
  }
  if (prov === 'rag' || prov === 'local') {
    return {
      name: 'rag',
      async ask({ prompt, context }) {
        // Simple summarizer over top contexts
        const ctx = (context || []).map((c, i) => `[[CTX ${i + 1}]] ${c.snippet} …\nSource: ${c.href}`).join('\n\n');
        const answer = `Local RAG (no LLM):\n\nTop matches for: "${prompt}"\n\n${ctx || '(no matches)'}\n\nTip: run with --provider=openai to synthesize an answer using cloud LLMs.`;
        return answer;
      }
    };
  }
  throw new Error(`Unknown provider: ${name}`);
}

// Compose a prompt with optional retrieved context
function buildPromptWithContext(question, contexts, extraTooling = '') {
  const ctx = contexts?.length
    ? `You are a helpful assistant with a clear, human tone. Explain step-by-step and prefer examples. Use CONTEXT for facts and cite sources by their /logs path.\n\nCONTEXT:\n${contexts.map((c, i) => `(${i + 1}) [${(c.tags||[]).join(', ')}] ${c.title} — ${c.href}\n${c.snippet}`).join('\n\n')}\n\n${extraTooling ? `TOOLS:\n${extraTooling}\n\n` : ''}QUESTION: ${question}`
    : `You are a helpful assistant with a clear, human tone. Explain step-by-step and prefer examples.${extraTooling ? `\n\nTOOLS:\n${extraTooling}` : ''}\n\nQUESTION: ${question}`;
  return ctx;
}

// --------- Command handlers
async function handleAsk(args) {
  const question = args._.slice(1).join(' ') || args.q || args.question;
  if (!question) throw new Error('Provide a question: ai ask "How to ..."');
  let rag = loadRagIndex();
  if (!rag) {
    // Attempt to build rag on the fly with correct cwd
    try { execSync('node scripts/build-rag.mjs', { cwd: siteDir, stdio: 'inherit' }); rag = loadRagIndex(); } catch {}
  }
  const k = Number(args.k || 6);
  const ctx = rag ? cosineRank(rag, question, k) : [];
  // Memory context
  let memCtx = [];
  if (!args['no-memory']) {
    try { memCtx = searchMemory({ query: question, k: Number(args['mem-k'] || 3) }); } catch {}
  }
  const providerName = args.provider || process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'rag');
  // Optional tool usage
  let toolsNote = '';
  if (args.analyze && args.file) {
    const fp = path.isAbsolute(args.file) ? args.file : path.join(repoRoot, args.file);
    if (fs.existsSync(fp)) toolsNote += `\nANALYZE(${args.file}):\n${analyzeFile(fp)}`;
  }
  if (args.code) {
    try {
      const { result, logs } = execJS(String(args.code));
      toolsNote += `\nCODE(exec-js): result=${JSON.stringify(result)} logs=${logs.join(' | ')}`;
    } catch (e) {
      toolsNote += `\nCODE(exec-js) error: ${e?.message || e}`;
    }
  }
  const provider = await getProvider(providerName);
  const memoryNote = memCtx.length ? `\nMEMORY:\n${memCtx.map((m,i)=>`(${i+1}) [${(m.tags||[]).join(', ')}] ${m.title} — ${m.source || m.file || ''}\n${m.summary || m.snippet || ''}`).join('\n\n')}` : '';
  const prompt = buildPromptWithContext(question, ctx, (toolsNote.trim()+memoryNote).trim());
  const answer = await provider.ask({ prompt, model: args.model, context: ctx });
  console.log(answer);
  // Save transcript
  try {
    const p = saveTranscript({ title: question, messages: [ { role: 'user', content: question }, { role: 'assistant', content: answer } ], tags: ['ai', provider.name] });
    if (args.route) await routeIncoming();
    if (!args.quiet) console.error(`\nSaved: ${path.relative(repoRoot, p)}${args.route ? ' (routed)' : ''}`);
  } catch {}
}

async function handleChat(args) {
  const providerName = args.provider || process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'rag');
  const provider = await getProvider(providerName);
  let rag = loadRagIndex();
  if (!rag) { try { execSync('node scripts/build-rag.mjs', { cwd: siteDir, stdio: 'inherit' }); rag = loadRagIndex(); } catch {} }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const askLine = (q) => new Promise(res => rl.question(q, res));
  const messages = [];
  let title = 'Chat Transcript';
  console.error(`Interactive chat started with provider: ${provider.name}. Type ":quit" to exit, ":save" to save.`);
  while (true) {
    const q = await askLine('You> ');
    if (!q) continue;
    if (q.trim() === ':quit') break;
    if (q.trim() === ':save') { saveTranscript({ title, messages, tags: ['ai', provider.name] }); console.error('Saved.'); continue; }
    if (!messages.length) title = q.slice(0, 80);
    // retrieve
    const ctx = rag ? cosineRank(rag, q, Number(args.k || 6)) : [];
    let memCtx = [];
    if (!args['no-memory']) {
      try { memCtx = searchMemory({ query: q, k: Number(args['mem-k'] || 3) }); } catch {}
    }
    let toolsNote = '';
    if (args.analyze && args.file) {
      const fp = path.isAbsolute(args.file) ? args.file : path.join(repoRoot, args.file);
      if (fs.existsSync(fp)) toolsNote += `\nANALYZE(${args.file}):\n${analyzeFile(fp)}`;
    }
    if (args.code) {
      try { const { result, logs } = execJS(String(args.code)); toolsNote += `\nCODE(exec-js): result=${JSON.stringify(result)} logs=${logs.join(' | ')}`; }
      catch (e) { toolsNote += `\nCODE(exec-js) error: ${e?.message || e}`; }
    }
  const memoryNote = memCtx.length ? `\nMEMORY:\n${memCtx.map((m,i)=>`(${i+1}) [${(m.tags||[]).join(', ')}] ${m.title} — ${m.source || m.file || ''}\n${m.summary || m.snippet || ''}`).join('\n\n')}` : '';
  const prompt = buildPromptWithContext(q, ctx, (toolsNote.trim()+memoryNote).trim());
    const ans = await provider.ask({ prompt, model: args.model, context: ctx });
    messages.push({ role: 'user', content: q }, { role: 'assistant', content: ans });
    console.log(`AI> ${ans}\n`);
  }
  rl.close();
  const p = saveTranscript({ title, messages, tags: ['ai', provider.name] });
  if (args.route) await routeIncoming();
  console.error(`Saved: ${path.relative(repoRoot, p)}${args.route ? ' (routed)' : ''}`);
}

async function handleRag(args) {
  const question = args._.slice(1).join(' ') || args.q || args.question;
  if (!question) throw new Error('Provide a question: ai rag "keyword ..."');
  let rag = loadRagIndex();
  if (!rag) { try { execSync('node scripts/build-rag.mjs', { cwd: siteDir, stdio: 'inherit' }); rag = loadRagIndex(); } catch {} }
  if (!rag) throw new Error('RAG index missing and build failed.');
  const k = Number(args.k || 8);
  const ctx = cosineRank(rag, question, k);
  for (const c of ctx) {
    console.log(`${c.score.toFixed(3)} ${c.href} :: ${c.title}`);
    console.log(c.snippet);
    console.log('');
  }
}

async function handleServe(args) {
  const port = Number(args.port || 11435);
  let rag = loadRagIndex();
  const providerName = args.provider || process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'rag');
  const provider = await getProvider(providerName);
  const server = http.createServer(async (req, res) => {
    try {
      // Simple SSE endpoint: /stream?q=...
      if (req.method === 'GET' && req.url && req.url.startsWith('/stream')) {
        const u = new URL(req.url, 'http://localhost');
        const question = u.searchParams.get('q') || u.searchParams.get('question') || '';
        if (!rag) { try { execSync('node scripts/build-rag.mjs', { cwd: siteDir, stdio: 'inherit' }); rag = loadRagIndex(); } catch {} }
        const ctx = rag ? cosineRank(rag, question, 6) : [];
        const providerName = args.provider || process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'rag');
        const provider = await getProvider(providerName);
        const prompt = buildPromptWithContext(question, ctx, '');
        const answer = await provider.ask({ prompt, context: ctx, model: args.model });
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'connection': 'keep-alive', 'access-control-allow-origin': '*' });
        const words = String(answer || '').split(/\s+/);
        let i = 0;
        const timer = setInterval(() => {
          if (i >= words.length) {
            res.write('event: done\n');
            res.write('data: {}\n\n');
            clearInterval(timer);
            res.end();
            return;
          }
          const chunk = words.slice(i, i + 20).join(' ');
          i += 20;
          res.write('data: ' + JSON.stringify({ chunk }) + '\n\n');
        }, 40);
        return;
      }
      if (req.method === 'POST' && req.url === '/ask') {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', async () => {
          const { question, k = 6, analyze: doAnalyze, file, code } = JSON.parse(body || '{}');
          if (!rag) { try { execSync('node scripts/build-rag.mjs', { cwd: siteDir, stdio: 'inherit' }); rag = loadRagIndex(); } catch {} }
          const ctx = rag ? cosineRank(rag, question, Number(k)) : [];
          let toolsNote = '';
          if (doAnalyze && file) {
            const fp = path.isAbsolute(file) ? file : path.join(repoRoot, file);
            if (fs.existsSync(fp)) toolsNote += `\nANALYZE(${file}):\n${analyzeFile(fp)}`;
          }
          if (code) {
            try { const { result, logs } = execJS(String(code)); toolsNote += `\nCODE(exec-js): result=${JSON.stringify(result)} logs=${logs.join(' | ')}`; }
            catch (e) { toolsNote += `\nCODE(exec-js) error: ${e?.message || e}`; }
          }
          const prompt = buildPromptWithContext(question, ctx, toolsNote.trim());
          const answer = await provider.ask({ prompt, context: ctx, model: args.model });
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ answer, ctx }));
        });
        return;
      }
      if (req.method === 'POST' && req.url === '/tool') {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', async () => {
          try {
            const { action, file, code, input, cmd, pattern, flags, title, content, tags, source, summary, data, query, k, limit, tag, url, format, save } = JSON.parse(body || '{}');
            if (action === 'analyze' && file) {
              const fp = path.isAbsolute(file) ? file : path.join(repoRoot, file);
              const out = fs.existsSync(fp) ? analyzeFile(fp) : 'File not found';
              res.writeHead(200, { 'content-type': 'application/json' });
              res.end(JSON.stringify({ ok: true, out }));
              return;
            }
            if (action === 'exec-js' && code) {
              try { const out = execJS(String(code), input); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, out })); }
              catch (e) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: e?.message || e })); }
              return;
            }
            if (action === 'grep' && pattern && file) {
              try {
                const out = grepText({ pattern: String(pattern), file: String(file), flags: String(flags || 'i') });
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: true, out }));
              } catch (e) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e?.message || e }));
              }
              return;
            }
            if (action === 'exec-sh' && cmd) {
              try {
                const out = execShell(String(cmd));
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: true, out }));
              } catch (e) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e?.message || e }));
              }
              return;
            }
            if (action === 'scrape:url' && url) {
              try {
                const out = await scrapeUrl({ url: String(url), format: format || 'markdown' });
                if (save) {
                  const arr = Array.isArray(tags) ? tags : String(tags||'').split(',').map(s=>s.trim()).filter(Boolean);
                  const mem = makeMemoryFromScrape({ out, kind: 'url' });
                  const saved = addMemory({ ...mem, tags: arr, data: { links: out.links||[], contentType: out.contentType||'' } });
                  res.writeHead(200, { 'content-type': 'application/json' });
                  res.end(JSON.stringify({ ok: true, out, saved }));
                } else {
                  res.writeHead(200, { 'content-type': 'application/json' });
                  res.end(JSON.stringify({ ok: true, out }));
                }
              } catch (e) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e?.message || e }));
              }
              return;
            }
            if (action === 'scrape:file' && file) {
              try {
                const out = scrapeFile({ file: String(file), format: format || 'markdown' });
                if (save) {
                  const arr = Array.isArray(tags) ? tags : String(tags||'').split(',').map(s=>s.trim()).filter(Boolean);
                  const mem = makeMemoryFromScrape({ out, kind: 'file' });
                  const saved = addMemory({ ...mem, tags: arr, data: { contentType: out.contentType||'' } });
                  res.writeHead(200, { 'content-type': 'application/json' });
                  res.end(JSON.stringify({ ok: true, out, saved }));
                } else {
                  res.writeHead(200, { 'content-type': 'application/json' });
                  res.end(JSON.stringify({ ok: true, out }));
                }
              } catch (e) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e?.message || e }));
              }
              return;
            }
            if (action === 'memory:add') {
              try {
                const arr = Array.isArray(tags) ? tags : String(tags||'').split(',').map(s=>s.trim()).filter(Boolean);
                const out = addMemory({ title, content, tags: arr, source, summary, data });
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: true, out }));
              } catch (e) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e?.message || e }));
              }
              return;
            }
            if (action === 'memory:build') {
              try {
                const out = buildMemoryIndex();
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: true, out }));
              } catch (e) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e?.message || e }));
              }
              return;
            }
            if (action === 'memory:list') {
              try {
                const items = listMemory({ limit: Number(limit)||50, tag });
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: true, items }));
              } catch (e) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e?.message || e }));
              }
              return;
            }
            if (action === 'memory:search') {
              try {
                const items = searchMemory({ query, k: Number(k)||10 });
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: true, items }));
              } catch (e) {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e?.message || e }));
              }
              return;
            }
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Unknown action' }));
          } catch (e) {
            res.writeHead(500, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e?.message || e }));
          }
        });
        return;
      }
      if (req.method === 'POST' && req.url === '/fs/read') {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', () => {
          try {
            const { file } = JSON.parse(body || '{}');
            const fp = path.isAbsolute(file) ? file : path.join(repoRoot, file);
            if (!isAllowed(fp)) { res.writeHead(403); return res.end('Forbidden'); }
            const text = fs.readFileSync(fp, 'utf8');
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true, text }));
          } catch (e) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: e?.message || e })); }
        });
        return;
      }
      if (req.method === 'POST' && req.url === '/fs/write') {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', () => {
          try {
            const { file, text } = JSON.parse(body || '{}');
            const fp = path.isAbsolute(file) ? file : path.join(repoRoot, file);
            if (!isAllowed(fp)) { res.writeHead(403); return res.end('Forbidden'); }
            ensureDir(path.dirname(fp));
            fs.writeFileSync(fp, String(text ?? ''));
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: e?.message || e })); }
        });
        return;
      }
      if (req.method === 'POST' && req.url === '/make/ui') {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', async () => {
          try {
            const { name, spec, provider } = JSON.parse(body || '{}');
            const out = await generateUIPage({ name: name || 'ui', spec: spec || 'Create a minimal UI.', providerName: provider || (process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'rag')) });
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true, out }));
          } catch (e) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: e?.message || e })); }
        });
        return;
      }
      if (req.method === 'POST' && req.url === '/rag') {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', async () => {
          const { question, k = 8 } = JSON.parse(body || '{}');
          if (!rag) { try { execSync('node scripts/build-rag.mjs', { cwd: siteDir, stdio: 'inherit' }); rag = loadRagIndex(); } catch {} }
          const ctx = rag ? cosineRank(rag, question, Number(k)) : [];
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ctx }));
        });
        return;
      }
      res.writeHead(404); res.end('Not found');
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: e?.message || String(e) }));
    }
  });
  server.listen(port, () => console.error(`AI server on http://localhost:${port} (provider=${provider.name})`));
}

async function routeIncoming() {
  try { execSync('node scripts/route-logs.mjs', { cwd: siteDir, stdio: 'inherit' }); } catch {}
}

// --------- FS helpers and UI generator
const allowedRoots = [
  path.join(repoRoot, 'logs'),
  publicDir,
];
function isAllowed(fp) {
  const r = path.resolve(fp);
  return allowedRoots.some((root) => r === root || r.startsWith(root + path.sep));
}
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

async function generateUIPage({ name, spec, providerName }) {
  const dest = path.join(uiRoot, name);
  ensureDir(dest);
  let html = '', css = '', js = '';
  let usedProvider = false;
  try {
    const provider = await getProvider(providerName);
    let context = '';
    const idxPath = path.join(publicDir, 'logs-index.json');
    if (fs.existsSync(idxPath)) {
      try { const parsed = JSON.parse(fs.readFileSync(idxPath, 'utf8')); context = `LOGS-INDEX: ${parsed.length} items, sample: ${parsed.slice(0,3).map(x=>x.title).join(' | ')}`; } catch {}
    }
    const prompt = `You are a senior frontend engineer. Generate a small single-page UI as JSON with keys {"html","css","js"}. No external CDNs. Keep code under ~100KB total. It should satisfy: ${spec}.\nContext: ${context}`;
    const out = await provider.ask({ prompt });
    let parsed;
    try { parsed = JSON.parse(out); }
    catch {
      const h = /```html[\s\S]*?```/i.exec(out)?.[0]?.replace(/```html|```/gi,'')?.trim();
      const c = /```css[\s\S]*?```/i.exec(out)?.[0]?.replace(/```css|```/gi,'')?.trim();
      const j = /```(js|javascript)[\s\S]*?```/i.exec(out)?.[0]?.replace(/```(js|javascript)|```/gi,'')?.trim();
      parsed = { html: h || '', css: c || '', js: j || '' };
    }
    html = String(parsed.html || ''); css = String(parsed.css || ''); js = String(parsed.js || '');
    usedProvider = !!(html || css || js);
  } catch {}
  if (!usedProvider) {
    const baseCss = `body{font-family:system-ui,Arial,sans-serif;margin:2rem;background:#0b0b0c;color:#e6e6e6}a{color:#7ccaff}input{padding:.5rem;border-radius:.5rem;border:1px solid #333;background:#111;color:#eee}ul{list-style:none;padding:0}li{padding:.5rem .25rem;border-bottom:1px solid #222}.tag{display:inline-block;margin-right:.25rem;padding:.1rem .4rem;border-radius:.4rem;background:#182330;color:#8ab4ff;font-size:.8rem}`;
    const baseHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><link rel="stylesheet" href="./app.css"></head><body><h1>${name}</h1><p>${spec}</p><input id="q" placeholder="filter..."/><ul id="list"></ul><script src="./app.js"></script></body></html>`;
    const baseJs = `async function main(){const res=await fetch('/logs-index.json');const items=await res.json();const list=document.getElementById('list');const q=document.getElementById('q');function render(arr){list.innerHTML='';arr.forEach(e=>{const li=document.createElement('li');li.innerHTML='<a href="'+e.href+'/">'+e.title+'</a> <small>'+e.date+'</small> '+(e.tags||[]).map(t=>'<span class="tag">#'+t+'</span>').join('');list.appendChild(li);});}render(items);q.addEventListener('input',()=>{const s=q.value.toLowerCase();render(items.filter(e=>e.title.toLowerCase().includes(s)||(e.tags||[]).some(t=>t.toLowerCase().includes(s))));});}main();`;
    html = baseHtml; css = baseCss; js = baseJs;
  }
  fs.writeFileSync(path.join(dest, 'index.html'), html);
  fs.writeFileSync(path.join(dest, 'app.css'), css);
  fs.writeFileSync(path.join(dest, 'app.js'), js);
  return { path: path.relative(publicDir, dest), files: ['index.html','app.css','app.js'], usedProvider };
}

// --------- Arg parsing and main
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        const k = a.slice(2, eq);
        const v = a.slice(eq + 1);
        out[k] = v === '' ? true : v;
      } else {
        const k = a.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) { out[k] = next; i++; }
        else { out[k] = true; }
      }
    } else out._.push(a);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const cmd = args._[0] || 'help';
  if (cmd === 'ask') return handleAsk(args);
  if (cmd === 'chat') return handleChat(args);
  if (cmd === 'rag') return handleRag(args);
  if (cmd === 'serve') return handleServe(args);
  if (cmd === 'tool') {
    const sub = args._[1];
    if (sub === 'scrape') {
      const target = args._[2];
      const format = args.format || 'markdown';
      const save = !!args.save;
      if (target === 'url' && args.url) {
        const out = await scrapeUrl({ url: args.url, format });
        if (save) {
          const mem = makeMemoryFromScrape({ out, kind: 'url' });
          const saved = addMemory({ ...mem, tags: (args.tags?String(args.tags).split(',').map(s=>s.trim()).filter(Boolean):[]), data: { links: out.links||[], contentType: out.contentType||'' } });
          console.log(JSON.stringify({ ok: true, scrape: out, saved }, null, 2));
        } else {
          console.log(JSON.stringify({ ok: true, out }, null, 2));
        }
        return;
      }
      if (target === 'file' && (args.file || args.f)) {
        const out = scrapeFile({ file: args.file || args.f, format });
        if (save) {
          const mem = makeMemoryFromScrape({ out, kind: 'file' });
          const saved = addMemory({ ...mem, tags: (args.tags?String(args.tags).split(',').map(s=>s.trim()).filter(Boolean):[]), data: { contentType: out.contentType||'' } });
          console.log(JSON.stringify({ ok: true, scrape: out, saved }, null, 2));
        } else {
          console.log(JSON.stringify({ ok: true, out }, null, 2));
        }
        return;
      }
      console.log('Usage: ai tool scrape url --url https://example.com [--format markdown|text|json] [--save] [--tags a,b] | ai tool scrape file --file logs/foo.md [--format markdown|text|json] [--save] [--tags a,b]');
      return;
    }
    if (sub === 'memory') {
      const action = args._[2] || args.action;
      if (action === 'add') {
        const title = args.title || args.t || 'Memory';
        const content = args.content || args.c || '';
        const tags = args.tags ? String(args.tags).split(',').map(s=>s.trim()).filter(Boolean) : [];
        const source = args.source || '';
        const summary = args.summary || '';
        const data = args.data ? JSON.parse(String(args.data)) : null;
        const out = addMemory({ title, content, tags, source, data, summary });
        console.log(JSON.stringify({ ok: true, out }, null, 2));
        return;
      }
      if (action === 'build') {
        const out = buildMemoryIndex();
        console.log(JSON.stringify({ ok: true, out }, null, 2));
        return;
      }
      if (action === 'list') {
        const out = listMemory({ limit: args.limit || 50, tag: args.tag || '' });
        console.log(JSON.stringify({ ok: true, items: out }, null, 2));
        return;
      }
      if (action === 'search') {
        const out = searchMemory({ query: args.query || args.q || '', k: args.k || 10 });
        console.log(JSON.stringify({ ok: true, items: out }, null, 2));
        return;
      }
      console.log('Usage: ai tool memory add --title t --content c [--tags a,b] [--source s] [--summary s] [--data JSON] | build | list [--limit N] [--tag t] | search --query q [--k 10]');
      return;
    }
    if (sub === 'analyze' && args.file) {
      const fp = path.isAbsolute(args.file) ? args.file : path.join(repoRoot, args.file);
      console.log(analyzeFile(fp));
      return;
    }
    if (sub === 'exec' && args.code) {
      const out = execJS(String(args.code));
      console.log(JSON.stringify(out, null, 2));
      return;
    }
    if (sub === 'grep') {
      const pattern = args.pattern || args.p;
      const file = args.file || args.f;
      const flags = args.flags || 'i';
      if (!pattern || !file) {
        console.log('Usage: ai tool grep --pattern "vulkan" --file logs/2025/09/17/vulkan-test.md [--flags i]');
        return;
      }
      const out = grepText({ pattern: String(pattern), file: String(file), flags: String(flags) });
      console.log(JSON.stringify(out, null, 2));
      return;
    }
    if (sub === 'sh') {
      const cmdline = args.cmd ? String(args.cmd) : args._.slice(2).join(' ');
      if (!cmdline) {
        console.log('Usage: ai tool sh --cmd "echo hello"');
        return;
      }
      const out = execShell(cmdline);
      console.log(JSON.stringify(out, null, 2));
      return;
    }
    console.log('Usage: ai tool analyze --file <path> | ai tool exec --code "..." | ai tool grep --pattern p --file <path> [--flags i] | ai tool sh --cmd "echo hello" | ai tool memory <add|build|list|search> ... | ai tool scrape url|file ...');
    return;
  }
  if (cmd === 'make' && args._[1] === 'ui') {
    const name = args.name || args._[2] || 'ui';
    const spec = args.spec || 'Provide a minimal UI over logs-index.json with search and tags.';
    const providerName = args.provider || process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'rag');
    const out = await generateUIPage({ name, spec, providerName });
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  const help = `AI CLI
Usage:
  node scripts/ai-cli.mjs ask "How do I build?" [--provider=openai|rag] [--k=6] [--model=...] [--route] [--analyze --file <path>] [--code "..."]
  node scripts/ai-cli.mjs chat [--provider=...] [--k=6] [--model=...] [--route] [--analyze --file <path>] [--code "..."]
  node scripts/ai-cli.mjs rag "vulkan shader" [--k=8]
  node scripts/ai-cli.mjs serve [--port=11435] [--provider=...] [--model=...]
  node scripts/ai-cli.mjs tool analyze --file <path>
  node scripts/ai-cli.mjs tool exec --code "const x=2; return x*2;"
  node scripts/ai-cli.mjs tool grep --pattern "foo" --file logs/2025/09/17/sample.md [--flags i]
  node scripts/ai-cli.mjs tool sh --cmd "ls logs/2025"
  node scripts/ai-cli.mjs tool memory add --title t --content c [--tags a,b]
  node scripts/ai-cli.mjs tool memory build | list [--limit N] [--tag t] | search --query q [--k 10]
  node scripts/ai-cli.mjs tool scrape url --url https://example.com [--format markdown|text|json] [--save] [--tags a,b]
  node scripts/ai-cli.mjs tool scrape file --file logs/foo.md [--format markdown|text|json] [--save] [--tags a,b]
  node scripts/ai-cli.mjs make ui --name <name> --spec "Short description"

Env:
  OPENAI_API_KEY, AI_PROVIDER=openai|rag

HTTP:
  POST /ask { question, k?, analyze?, file?, code? }
  POST /rag { question, k? }
  POST /tool { action: analyze|exec-js|grep|exec-sh|memory:add|memory:build|memory:list|memory:search, ... }
  GET  /stream?q=your+question  # text/event-stream of answer chunks
`;
  console.log(help);
}

main().catch((e) => { console.error(e); process.exit(1); });
