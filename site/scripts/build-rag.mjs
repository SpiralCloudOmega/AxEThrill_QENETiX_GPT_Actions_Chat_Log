#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import fg from 'fast-glob';
import { normalizeTags, loadUiConfigTagAliases, applyTagAliases } from './lib/tags.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');
const logsDir = path.join(repoRoot, 'logs');
const publicDir = path.join(siteDir, 'public');

function parseHeader(md) {
  const lines = md.split('\n');
  const fm = {};
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < Math.min(lines.length, 50); i++) {
      const line = lines[i];
      if (line.trim() === '---') break;
      const m = /^(\w[\w-]*):\s*(.*)$/.exec(line);
      if (m) fm[m[1].toLowerCase()] = m[2].trim();
    }
  }
  const head = lines.slice(0, 40).join('\n');
  const id = (head.match(/Conversation ID:\s*(.+)/i)?.[1] ?? fm.id ?? '').trim();
  const receivedAt = (head.match(/Received At:\s*([^\n]+)/i)?.[1] ?? fm.receivedat ?? fm.date ?? '').trim();
  const title = (md.match(/^#\s*(.+)$/m)?.[1] ?? fm.title ?? 'Chat Transcript').trim();
  const tagsStr = fm.tags || head.match(/Tags:\s*([^\n]+)/i)?.[1] || '';
  const raw = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const norm = normalizeTags(raw);
  const aliases = loadUiConfigTagAliases();
  const tags = applyTagAliases(norm, aliases);
  return { id, receivedAt, title, tags };
}

const STOP = new Set('the,of,and,to,in,a,for,is,that,on,with,as,it,by,from,at,be,an,or,are,this,was,will,can,not,have,has,had,if,then,else,do,does,did,than,which,into,over,under,between,within,without,about,after,before,since,per,each,via'.split(','));

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9_]+/g) || []).filter((t) => t.length > 1 && !STOP.has(t));
}

function paragraphChunks(text, minLen = 600, maxLen = 1200) {
  const paras = text.split(/\n\n+/);
  const out = [];
  let cur = '';
  for (const p of paras) {
    const block = p.trim();
    if (!block) continue;
    if ((cur + '\n\n' + block).length <= maxLen) {
      cur = cur ? cur + '\n\n' + block : block;
    } else {
      if (cur) out.push(cur);
      cur = block;
      if (cur.length > maxLen) {
        // hard split long paragraph
        for (let i = 0; i < cur.length; i += maxLen) out.push(cur.slice(i, i + maxLen));
        cur = '';
      }
    }
  }
  if (cur) out.push(cur);
  // Merge small tails
  const merged = [];
  for (const c of out) {
    if (merged.length && merged[merged.length - 1].length < minLen) {
      merged[merged.length - 1] += '\n\n' + c;
    } else {
      merged.push(c);
    }
  }
  return merged;
}

function buildIndex(entries) {
  const df = new Map();
  const chunks = [];
  for (const e of entries) {
    const parts = paragraphChunks(e.body);
    for (let i = 0; i < parts.length; i++) {
      const text = parts[i];
      const tokens = tokenize(text);
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of new Set(tokens)) df.set(t, (df.get(t) || 0) + 1);
      chunks.push({ e, i, text, tf });
    }
  }
  const N = chunks.length || 1;
  const idf = new Map();
  for (const [t, c] of df) idf.set(t, Math.log((N + 1) / (c + 1)) + 1);
  const out = [];
  const vocab = new Set();
  for (const c of chunks) {
    const weights = [];
    let sumsq = 0;
    for (const [t, f] of c.tf) {
      const w = (f) * (idf.get(t) || 1);
      if (w > 0) {
        weights.push([t, w]);
        sumsq += w * w;
      }
    }
    // keep top 32
    weights.sort((a, b) => b[1] - a[1]);
    const top = weights.slice(0, 32);
    top.forEach(([t]) => vocab.add(t));
    const norm = Math.sqrt(sumsq) || 1;
    out.push({
      id: `${c.e.relPath}#${c.i}`,
      href: c.e.href,
      relPath: c.e.relPath,
      title: c.e.title,
      date: c.e.date,
      tags: c.e.tags,
      snippet: c.text.slice(0, 280).replace(/\s+/g, ' '),
      vector: top,
      norm
    });
  }
  // idf map only for used terms to reduce size
  const idfObj = {};
  for (const t of vocab) idfObj[t] = idf.get(t) || 1;
  return { chunks: out, idf: idfObj };
}

function crc32(buf) {
  let c = ~0; // 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return ~c >>> 0;
}

function writePNGWithzTXt(chunksData) {
  // base 1x1 transparent PNG bytes
  const base = Buffer.from([
    0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,
    0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x06,0x00,0x00,0x00,0x1f,0x15,0xc4,0x89,
    0x00,0x00,0x00,0x0a,0x49,0x44,0x41,0x54,0x78,0x9c,0x63,0x60,0x00,0x00,0x00,0x02,0x00,0x01,0xe5,0x27,0xd4,0xa2,
    0x00,0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82
  ]);
  // Insert zTXt before IEND
  const iendIndex = base.lastIndexOf(Buffer.from([0x49,0x45,0x4e,0x44]));
  const head = base.slice(0, iendIndex - 4); // include previous length and type? We cut before length of IEND
  const iendChunk = base.slice(iendIndex - 4); // length+IEND+CRC
  const parts = [head];
  for (const { keyword, text } of chunksData) {
    const keyBuf = Buffer.from(keyword, 'latin1');
    const sep = Buffer.from([0x00]);
    const method = Buffer.from([0x00]);
    const compressed = zlib.deflateSync(Buffer.from(text, 'utf8'));
    const data = Buffer.concat([keyBuf, sep, method, compressed]);
    const type = Buffer.from('zTXt');
    const crc = Buffer.alloc(4);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcVal = crc32(Buffer.concat([type, data]));
    crc.writeUInt32BE(crcVal, 0);
    parts.push(len, type, data, crc);
  }
  parts.push(iendChunk);
  return Buffer.concat(parts);
}

async function run() {
  if (!fs.existsSync(logsDir)) {
    console.log('No logs dir for RAG, skipping.');
    return;
  }
  fs.mkdirSync(publicDir, { recursive: true });
  const files = await fg('**/*.md', { cwd: logsDir });
  const entries = files.map((rel) => {
    const full = path.join(logsDir, rel);
    const md = fs.readFileSync(full, 'utf8');
    const meta = parseHeader(md);
    const slug = rel.replace(/\.md$/i, '');
    const [yyyy, mm, dd] = slug.split(path.sep);
    const date = yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : meta.receivedAt;
    return {
      href: '/logs/' + slug.split(path.sep).join('/'),
      relPath: 'logs/' + rel,
      title: meta.title || rel,
      date,
      tags: meta.tags,
      body: md
    };
  });

  const { chunks, idf } = buildIndex(entries);
  const rag = { version: 1, builtAt: new Date().toISOString(), idf, chunksCount: chunks.length };
  const ragIndex = { ...rag, chunks };
  fs.writeFileSync(path.join(publicDir, 'rag-index.json'), JSON.stringify(ragIndex, null, 2));

  // Build PNG capsule; split into segments ~60KB after compression
  const json = JSON.stringify(ragIndex);
  const comp = zlib.deflateSync(Buffer.from(json));
  const maxSeg = 60 * 1024;
  const segments = [];
  for (let i = 0; i < comp.length; i += maxSeg) segments.push(comp.slice(i, i + maxSeg));
  const chunksData = [{ keyword: 'rag-capsule', text: JSON.stringify({ parts: segments.length }) }];
  segments.forEach((seg, i) => {
    chunksData.push({ keyword: `rag-${i.toString().padStart(3,'0')}`, text: seg.toString('base64') });
  });
  const png = writePNGWithzTXt(chunksData);
  fs.writeFileSync(path.join(publicDir, 'rag-capsule.png'), png);
  console.log(JSON.stringify({ chunks: chunks.length, terms: Object.keys(idf).length, capsuleParts: segments.length }));
}

run().catch((e) => { console.error(e); process.exit(1); });
