#!/usr/bin/env node
// Minimal MCP-style JSON-RPC 2.0 server (read-only phase 1)
// Methods implemented:
//  Read:
//    - logs.list      params: { tag?, limit? }
//    - logs.get       params: { href | path }
//    - memory.list    params: { tag?, limit? }
//    - memory.get     params: { id }
//    - rag.search     params: { query, k? }
//    - health.snapshot (no params)
//    - token.ledger   (no params)
//  Write (API key required):
//    - ingest.add     params: { title?, content, tags?[] }
//    - memory.add     params: { title, content, tags?[], source?, summary? }
// Auth (optional): set MCP_API_KEY env; client must send header x-api-key.
// Usage: node scripts/mcp-server.mjs [--port 12812]
// Add script alias: npm run mcp:serve

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';

const repoRoot = path.resolve(path.join(process.cwd(), '..'));
const siteDir = path.join(repoRoot, 'site');
const publicDir = path.join(siteDir, 'public');
const logsDir = path.join(repoRoot, 'logs');
const memoryDir = path.join(logsDir, 'memory');
const ledgerFile = path.join(memoryDir, 'agent-state', 'token-ledger.json');
const incomingDir = path.join(logsDir, 'incoming');
const mcpRootDir = path.join(memoryDir, 'mcp'); // holds request logs + rate limits


function nowISO(){ return new Date().toISOString(); }
function slugify(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'entry'; }
function ensureDir(p){ fs.mkdirSync(p,{ recursive:true }); }

// ---- Utilities ----
function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function loadLogsIndex() { return readJSON(path.join(publicDir, 'logs-index.json'), []); }
function loadMemoryIndex() { return readJSON(path.join(publicDir, 'memory-index.json'), []); }
function loadRagIndex() { return readJSON(path.join(publicDir, 'rag-index.json'), null); }
function loadHealth() { return readJSON(path.join(publicDir, 'health.json'), null); }
function loadLedger() { return readJSON(ledgerFile, { days: {}, updatedAt: 0 }); }

// Basic tokenizer & cosine (mirrors ai-cli implementation subset)
const STOP = new Set('the,of,and,to,in,a,for,is,that,on,with,as,it,by,from,at,be,an,or,are,this,was,will,can,not,have,has,had,if,then,else,do,does,did,than,which,into,over,under,between,within,without,about,after,before,since,per,each,via'.split(','));
function tokenize(text) { return (text.toLowerCase().match(/[a-z0-9_]+/g) || []).filter(t => t.length > 1 && !STOP.has(t)); }
function buildQueryVector(q, idf) {
  const toks = tokenize(q); const tf = new Map();
  toks.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
  const vec = []; let sumsq = 0;
  for (const [t,f] of tf) { const w = f * (idf[t] || 1); if (w>0){ vec.push([t,w]); sumsq += w*w; } }
  const norm = Math.sqrt(sumsq) || 1; return { vec, norm };
}
function cosineRank(rag, query, topK=6) {
  if (!rag?.chunks?.length) return [];
  const { vec, norm } = buildQueryVector(query, rag.idf || {});
  const qWeights = Object.fromEntries(vec);
  const scores = [];
  for (let i=0;i<rag.chunks.length;i++) {
    const c = rag.chunks[i]; let dot=0;
    for (const [t,w] of c.vector) { const qw = qWeights[t]; if (qw) dot += w*qw; }
    const denom = (c.norm||1)*norm; const s = denom? dot/denom : 0;
    if (s>0) scores.push([i,s]);
  }
  scores.sort((a,b)=>b[1]-a[1]);
  return scores.slice(0, topK).map(([i,s]) => ({ score:s, ...rag.chunks[i] }));
}

// ---- Method Implementations ----
const methods = {
  'agent.summarize': ({ query='', limit=8, provider }) => {
    // Lightweight summarization: gather top log titles/snippets via TF-IDF (rag) and produce a simple bullet list.
    // If a provider env (GEMINI_API_KEY/OpenAI) is present and provider param requested, we could in future call out; for now local summary.
    const rag = loadRagIndex();
    if (!rag) return { summary: '(rag index unavailable)', items: [] };
    const q = query || 'recent activity';
    const k = Number(limit)||8;
    const ranked = cosineRank(rag, q, k);
    const items = ranked.map(r => ({ href: r.href, title: r.title, snippet: r.snippet, score: r.score }));
    const summary = 'Summary for ' + JSON.stringify(q) + ':\n' + items.map(i=>`- ${i.title} (${i.href})`).join('\n');
    return { summary, items, model: 'local-rag', degraded: true };
  },
  'logs.list': ({ tag, limit=100 }={}) => {
    const items = loadLogsIndex();
    let out = items;
    if (tag) out = out.filter(i => (i.tags||[]).includes(tag));
    return out.slice(0, Number(limit));
  },
  'logs.get': ({ href, path: p }) => {
    const target = href || p;
    if (!target) throw rpcError('INVALID_INPUT', 'Provide href or path');
    if (target.includes('..')) throw rpcError('INVALID_INPUT', 'Path traversal disallowed');
    // href in logs-index.json usually like logs/2025/09/18/foo -> we expect .md file under logs.
    let full = target;
    if (!full.endsWith('.md')) full += '.md';
    const abs = path.join(repoRoot, full);
    if (!abs.startsWith(logsDir)) throw rpcError('INVALID_INPUT', 'Outside logs root');
    if (!fs.existsSync(abs)) throw rpcError('NOT_FOUND', 'Log not found');
    const text = fs.readFileSync(abs, 'utf8');
    return { path: full, bytes: Buffer.byteLength(text), content: text };
  },
  'memory.list': ({ tag, limit=100 }={}) => {
    const items = loadMemoryIndex();
    let out = items;
    if (tag) out = out.filter(m => (m.tags||[]).includes(tag));
    return out.slice(0, Number(limit));
  },
  'memory.get': ({ id }) => {
    if (!id) throw rpcError('INVALID_INPUT', 'Provide id');
    const capsulePath = path.join(memoryDir, `${id}.json`);
    if (!capsulePath.startsWith(memoryDir)) throw rpcError('INVALID_INPUT','Bad id');
    if (!fs.existsSync(capsulePath)) throw rpcError('NOT_FOUND','Capsule not found');
    return readJSON(capsulePath, {});
  },
  'rag.search': ({ query, k=6 }) => {
    if (!query) throw rpcError('INVALID_INPUT', 'Provide query');
    const rag = loadRagIndex();
    if (!rag) return { chunks: [], tookMs: 0 };
    const t0 = Date.now();
    const chunks = cosineRank(rag, query, Number(k));
    return { chunks: chunks.map(c => ({ score: c.score, href: c.href, title: c.title, snippet: c.snippet })), tookMs: Date.now()-t0 };
  },
  'health.snapshot': () => {
    return loadHealth();
  },
  'token.ledger': () => {
    const data = loadLedger();
    const today = new Date().toISOString().slice(0,10);
    const days = data.days||{}; const usedToday = days[today]||0;
    const total = Object.values(days).reduce((a,b)=>a+Number(b||0),0);
    return { today, usedToday, total, limit: Number(process.env.TOKEN_DAILY_LIMIT||500000), days };
  },
  // --- Write methods (require API key) ---
  'ingest.add': ({ title, content, tags=[] }) => {
    if (!content || typeof content !== 'string') throw rpcError('INVALID_INPUT','content required');
    if (!Array.isArray(tags)) throw rpcError('INVALID_INPUT','tags must be array');
    const ts = new Date();
    const stamp = ts.toISOString().replace(/[-:]/g,'').replace(/\..*/,''); // YYYYMMDDTHHMMSS
    const yyyy = String(ts.getFullYear());
    const mm = String(ts.getMonth()+1).padStart(2,'0');
    const dd = String(ts.getDate()).padStart(2,'0');
    ensureDir(incomingDir);
    const fname = `${yyyy}-${mm}-${dd}-${stamp}-${slugify(title||content.slice(0,40))}.md`;
    const filePath = path.join(incomingDir, fname);
    const tagLine = tags.length ? `\nTags: ${tags.join(', ')}` : '';
    const body = `# ${title || 'Untitled'}\n\nReceived At: ${nowISO()}${tagLine}\n\n${content.trim()}\n`;
    fs.writeFileSync(filePath, body, 'utf8');
    return { ok:true, file: path.relative(repoRoot, filePath) };
  },
  'memory.add': ({ title, content, tags=[], source='', summary='' }) => {
    if (!title || !content) throw rpcError('INVALID_INPUT','title and content required');
    if (!Array.isArray(tags)) throw rpcError('INVALID_INPUT','tags must be array');
    // Store as capsule-like JSON in logs/memory (id = hash)
    ensureDir(memoryDir);
    const id = crypto.createHash('sha1').update(`${title}\n${content}\n${Date.now()}`).digest('hex').slice(0,16);
    const capsule = {
      id,
      title,
      tags,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      source,
      summary,
      content,
      bytes: Buffer.byteLength(content)
    };
    fs.writeFileSync(path.join(memoryDir, `${id}.json`), JSON.stringify(capsule,null,2));
    return { ok:true, id };
  }
};

// ---- JSON-RPC Helpers ----
function rpcError(code, message, details) {
  const m = typeof message === 'string' ? message : 'Error';
  const err = new Error(m); err.rpc = { code, message:m, details }; return err;
}
function makeErrorObject(err) {
  if (err?.rpc) return { code: err.rpc.code, message: err.rpc.message, data: err.rpc.details };
  return { code: 'INTERNAL', message: err?.message || String(err) };
}

// ---- Server ----
function parseArgs(argv) { const out={_:[]}; for (let i=2;i<argv.length;i++){const a=argv[i]; if(a.startsWith('--')){const eq=a.indexOf('='); if(eq!==-1){out[a.slice(2,eq)]=a.slice(eq+1);} else {const k=a.slice(2); const n=argv[i+1]; if(n && !n.startsWith('-')){out[k]=n;i++;} else out[k]=true;}} else out._.push(a);} return out; }

const args = parseArgs(process.argv);
const port = Number(args.port || process.env.MCP_PORT || 12812);
const apiKey = process.env.MCP_API_KEY || '';

const server = http.createServer((req,res) => {
  // CORS
  res.setHeader('access-control-allow-origin','*');
  res.setHeader('access-control-allow-headers','content-type,x-api-key');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200, { 'content-type':'application/json' });
    return res.end(JSON.stringify({ ok:true, ts: Date.now() }));
  }

  if (req.method !== 'POST' || req.url !== '/mcp') { res.writeHead(404); return res.end('Not found'); }
  if (apiKey) {
    const provided = req.headers['x-api-key'];
    if (provided !== apiKey) {
      res.writeHead(401, { 'content-type':'application/json' });
      return res.end(JSON.stringify({ jsonrpc:'2.0', error:{ code:'UNAUTHORIZED', message:'Invalid API key' }, id:null }));
    }
  }
  let body='';
  req.on('data', c => {
    body += c; if (body.length > 200_000) { body=''; res.writeHead(413); res.end('Payload too large'); req.destroy(); }
  });
  req.on('end', () => {
    let payload; try { payload = JSON.parse(body||'{}'); } catch { payload = null; }
    const id = payload?.id ?? null;
    if (!payload || payload.jsonrpc !== '2.0' || typeof payload.method !== 'string') {
      res.writeHead(400, { 'content-type':'application/json' });
      return res.end(JSON.stringify({ jsonrpc:'2.0', error:{ code:'INVALID_REQUEST', message:'Bad JSON-RPC envelope' }, id }));
    }
    const fn = methods[payload.method];
    if (!fn) {
      res.writeHead(200, { 'content-type':'application/json' });
      return res.end(JSON.stringify({ jsonrpc:'2.0', error:{ code:'METHOD_NOT_FOUND', message:'Unknown method' }, id }));
    }
    // Enforce API key for write methods
    const write = payload.method.startsWith('ingest.') || payload.method.startsWith('memory.add');
    if (write && !apiKey) {
      res.writeHead(200, { 'content-type':'application/json' });
      return res.end(JSON.stringify({ jsonrpc:'2.0', error:{ code:'UNAUTHORIZED', message:'API key required for write method' }, id }));
    }
    // ---- Rate limiting (simple daily counter) ----
    try {
      const limit = Number(process.env.MCP_DAILY_REQ_LIMIT || 500);
      if (limit > 0) {
        ensureDir(mcpRootDir);
        const rateFile = path.join(mcpRootDir, 'rate-limits.json');
        const today = new Date().toISOString().slice(0,10);
        let rate = readJSON(rateFile, { date: today, counts: {} });
        if (rate.date !== today) rate = { date: today, counts: {} };
        const bucket = apiKey ? 'auth' : 'anon';
        const used = rate.counts[bucket] || 0;
        if (used >= limit) {
          // Log the rate limited attempt (without increment)
          logMcpRequest({ method: payload.method, params: payload.params, ok: false, error: { code:'RATE_LIMIT', message:'Daily request limit reached' }, ms:0 });
          res.writeHead(200, { 'content-type':'application/json' });
          return res.end(JSON.stringify({ jsonrpc:'2.0', error:{ code:'RATE_LIMIT', message:'Daily request limit reached' }, id }));
        }
        rate.counts[bucket] = used + 1; // pre-increment (counts requests attempted, even if they error later)
        fs.writeFileSync(rateFile, JSON.stringify(rate,null,2));
      }
    } catch (e) {
      // Do not block on rate limiting errors
    }
    // ---- Execute & log ----
    const t0 = Date.now();
    const paramBytes = Buffer.byteLength(JSON.stringify(payload.params||{}));
    let resultObj;
    let errorObj;
    try {
      const result = fn(payload.params || {});
      resultObj = result;
      res.writeHead(200, { 'content-type':'application/json' });
      res.end(JSON.stringify({ jsonrpc:'2.0', result, id }));
    } catch (e) {
      errorObj = makeErrorObject(e);
      res.writeHead(200, { 'content-type':'application/json' });
      res.end(JSON.stringify({ jsonrpc:'2.0', error: errorObj, id }));
    }
    const ms = Date.now() - t0;
    try {
      logMcpRequest({
        method: payload.method,
        params: payload.params,
        ok: !errorObj,
        error: errorObj,
        ms,
        resultBytes: resultObj ? Buffer.byteLength(JSON.stringify(resultObj)) : 0,
        paramBytes
      });
    } catch {}
  });
});

server.listen(port, () => {
  const keyNote = apiKey ? ' (auth enabled)' : ' (no auth)';
  console.error(`[mcp] server listening on http://localhost:${port}/mcp${keyNote}`);
});

// ---- Logging helper (kept at bottom to avoid hoist confusion) ----
function logMcpRequest({ method, params, ok, error, ms, resultBytes=0, paramBytes=0 }) {
  ensureDir(mcpRootDir);
  const now = new Date();
  const day = now.toISOString().slice(0,10);
  const dayDir = path.join(mcpRootDir, day);
  ensureDir(dayDir);
  const ts = now.toISOString().replace(/[:]/g,'-');
  const rid = crypto.randomUUID ? crypto.randomUUID().slice(0,8) : Math.random().toString(36).slice(2,10);
  const logId = `${day}_${ts}_${rid}`;
  const entry = {
    id: logId,
    ts: now.toISOString(),
    method,
    ok,
    ms,
    paramBytes,
    resultBytes,
    error: error ? { code: error.code, message: error.message } : undefined
  };
  const filePath = path.join(dayDir, `${ts}-${rid}.json`);
  const full = { ...entry, params: params || {} };
  try { fs.writeFileSync(filePath, JSON.stringify(full,null,2)); } catch {}
  // Rolling index (last 500)
  try {
    const indexFile = path.join(mcpRootDir, 'index.json');
    const idx = readJSON(indexFile, []);
    idx.unshift(entry);
    const trimmed = idx.slice(0,500);
    fs.writeFileSync(indexFile, JSON.stringify(trimmed,null,2));
  } catch {}
}
