#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const siteDir = process.cwd();
const publicDir = path.join(siteDir, 'public');

function readChunks(buf) {
  // PNG: 8-byte signature, then chunks [len(4)][type(4)][data(len)][crc(4)]
  const sig = buf.slice(0, 8);
  const chunks = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off); off += 4;
    const type = buf.slice(off, off + 4).toString('latin1'); off += 4;
    const data = buf.slice(off, off + len); off += len;
    const crc = buf.readUInt32BE(off); off += 4;
    chunks.push({ type, data, crc, len });
    if (type === 'IEND') break;
  }
  return chunks;
}

async function run() {
  const pngPath = path.join(publicDir, 'rag-capsule.png');
  if (!fs.existsSync(pngPath)) {
    console.error('No rag-capsule.png in public/. Run build-rag or prebuild first.');
    process.exit(1);
  }
  const buf = fs.readFileSync(pngPath);
  const chunks = readChunks(buf);
  const parts = [];
  let meta = null;
  for (const ch of chunks) {
    if (ch.type !== 'zTXt') continue;
    // zTXt: keyword (latin1) + 0x00 + compression method (0) + compressed text
    const zero = ch.data.indexOf(0);
    if (zero < 0 || zero + 2 > ch.data.length) continue;
    const keyword = ch.data.slice(0, zero).toString('latin1');
    const method = ch.data.readUInt8(zero + 1);
    const comp = ch.data.slice(zero + 2);
    if (method !== 0) continue;
    const text = zlib.inflateSync(comp).toString('utf8');
    if (keyword === 'rag-capsule') {
      meta = JSON.parse(text);
    } else if (/^rag-\d{3}$/.test(keyword)) {
      parts.push(text);
    }
  }
  if (!parts.length) {
    console.error('No rag-* parts found in PNG.');
    process.exit(1);
  }
  const comp = Buffer.concat(parts.map((b64) => Buffer.from(b64, 'base64')));
  const json = zlib.inflateSync(comp).toString('utf8');
  const out = path.join(publicDir, 'rag-index.json');
  fs.writeFileSync(out, json);
  console.log('Extracted rag-index.json with', JSON.parse(json).chunks?.length || 0, 'chunks');
}

run().catch((e) => { console.error(e); process.exit(1); });
