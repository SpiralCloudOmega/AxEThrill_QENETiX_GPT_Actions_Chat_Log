import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');
const logsDir = path.join(repoRoot, 'logs');
const memoryDir = path.join(logsDir, 'memory');
const publicDir = path.join(siteDir, 'public');

function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); }
function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'memory'; }
function nowISO(){ return new Date().toISOString(); }

export function getMemoryDir(){ ensureDir(memoryDir); return memoryDir; }

export function addMemory({ title, content, tags = [], source = '', data = null, summary = '' }){
  ensureDir(memoryDir);
  const ts = new Date();
  const yyyy = String(ts.getFullYear());
  const mm = String(ts.getMonth()+1).padStart(2,'0');
  const dd = String(ts.getDate()).padStart(2,'0');
  const hh = String(ts.getHours()).padStart(2,'0');
  const mi = String(ts.getMinutes()).padStart(2,'0');
  const ss = String(ts.getSeconds()).padStart(2,'0');
  const stamp = `${yyyy}-${mm}-${dd}-${hh}${mi}${ss}`;
  const base = `${stamp}-${slugify(title)}`;
  const dir = path.join(memoryDir, yyyy, mm, dd);
  ensureDir(dir);
  const file = path.join(dir, `${base}.json`);
  const capsule = {
    id: base,
    ts: nowISO(),
    title: String(title||'Memory Capsule'),
    tags: Array.isArray(tags) ? tags : String(tags||'').split(',').map(s=>s.trim()).filter(Boolean),
    source: String(source||''),
    summary: String(summary||'').slice(0, 2000),
    content: String(content||'').slice(0, 10000),
    data: data ?? null,
    version: 1
  };
  fs.writeFileSync(file, JSON.stringify(capsule, null, 2));
  return { path: file, capsule };
}

function readAllCapsules(){
  ensureDir(memoryDir);
  const out = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d)){
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.json')){
        try { const c = JSON.parse(fs.readFileSync(p,'utf8')); out.push({ file: p, capsule: c }); } catch {}
      }
    }
  };
  walk(memoryDir);
  return out;
}

export function buildMemoryIndex(){
  const items = readAllCapsules().map(({ file, capsule }) => ({
    id: capsule.id,
    ts: capsule.ts,
    title: capsule.title,
    tags: capsule.tags || [],
    source: capsule.source || '',
    summary: capsule.summary || '',
    snippet: (capsule.content||'').slice(0, 280),
    file: path.relative(repoRoot, file)
  })).sort((a,b)=> (a.ts<b.ts?1:-1));
  ensureDir(publicDir);
  const outPath = path.join(publicDir, 'memory-index.json');
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
  return { count: items.length, path: outPath };
}

export function listMemory({ limit = 50, tag = '' } = {}){
  const idxPath = path.join(publicDir, 'memory-index.json');
  let items = [];
  if (fs.existsSync(idxPath)){
    try { items = JSON.parse(fs.readFileSync(idxPath,'utf8')); } catch {}
  } else {
    items = readAllCapsules().map(({ file, capsule }) => ({
      id: capsule.id, ts: capsule.ts, title: capsule.title, tags: capsule.tags||[], source: capsule.source||'', summary: capsule.summary||'', snippet: (capsule.content||'').slice(0,280), file: path.relative(repoRoot, file)
    }));
  }
  if (tag) items = items.filter(x => (x.tags||[]).map(t=>t.toLowerCase()).includes(String(tag).toLowerCase()));
  items.sort((a,b)=> (a.ts<b.ts?1:-1));
  return items.slice(0, Number(limit)||50);
}

function tokenize(text){ return (String(text||'').toLowerCase().match(/[a-z0-9_]+/g)||[]).filter(t=>t.length>1); }
export function searchMemory({ query, k = 10 } = {}){
  const idxPath = path.join(publicDir, 'memory-index.json');
  let items = [];
  if (fs.existsSync(idxPath)){
    try { items = JSON.parse(fs.readFileSync(idxPath,'utf8')); } catch {}
  } else {
    items = readAllCapsules().map(({ file, capsule }) => ({ id: capsule.id, ts: capsule.ts, title: capsule.title, tags: capsule.tags||[], source: capsule.source||'', summary: capsule.summary||'', snippet: (capsule.content||'').slice(0,280), file: path.relative(repoRoot, file) }));
  }
  const q = tokenize(query);
  const scored = items.map(it => {
    const hay = [it.title, it.summary, it.snippet, ...(it.tags||[])].join(' ').toLowerCase();
    let score = 0;
    for (const t of q){
      const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')}\\b`, 'g');
      const matches = hay.match(re);
      score += matches ? matches.length : 0;
    }
    return { item: it, score };
  }).filter(x=>x.score>0);
  scored.sort((a,b)=> b.score - a.score || (a.item.ts<b.item.ts?1:-1));
  return scored.slice(0, Number(k)||10).map(x=>x.item);
}

export default {
  getMemoryDir,
  addMemory,
  buildMemoryIndex,
  listMemory,
  searchMemory,
};
