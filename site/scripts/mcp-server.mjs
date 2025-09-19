#!/usr/bin/env node
// Minimal MCP-style JSON-RPC 2.0 server (read-only phase 1)
// Methods implemented (all read-only):
//  - logs.list      params: { tag?, limit? }
//  - logs.get       params: { href | path }
//  - memory.list    params: { tag?, limit? }
//  - memory.get     params: { id }
//  - rag.search     params: { query, k? }
//  - health.snapshot (no params)
//  - token.ledger   (no params)
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
    try {
      const result = fn(payload.params || {});
      res.writeHead(200, { 'content-type':'application/json' });
      res.end(JSON.stringify({ jsonrpc:'2.0', result, id }));
    } catch (e) {
      const errObj = makeErrorObject(e);
      res.writeHead(200, { 'content-type':'application/json' });
      res.end(JSON.stringify({ jsonrpc:'2.0', error: errObj, id }));
    }
  });
});

server.listen(port, () => {
  const keyNote = apiKey ? ' (auth enabled)' : ' (no auth)';
  console.error(`[mcp] server listening on http://localhost:${port}/mcp${keyNote}`);
});
