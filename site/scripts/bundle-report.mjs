#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const nextStatic = path.join(siteDir, '.next', 'static');
const publicDir = path.join(siteDir, 'public');

function collectFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const ents = fs.readdirSync(cur, { withFileTypes: true });
    for (const ent of ents) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile() && /\.js$/.test(ent.name)) {
        const stat = fs.statSync(full);
        out.push({ path: full, rel: path.relative(dir, full), bytes: stat.size });
      }
    }
  }
  return out;
}

function formatBytes(n){
  if (n < 1024) return n + ' B';
  const units = ['KB','MB','GB'];
  let u = -1; let v = n;
  do { v /= 1024; u++; } while (v >= 1024 && u < units.length - 1);
  return v.toFixed(2) + ' ' + units[u];
}

function main(){
  const files = collectFiles(nextStatic);
  const chunks = files.filter(f => f.rel.includes('chunks'));
  const total = chunks.reduce((a,c)=>a+c.bytes,0);
  chunks.sort((a,b)=>b.bytes - a.bytes);
  const top = chunks.slice(0, 30).map(c => ({ file: c.rel, bytes: c.bytes, human: formatBytes(c.bytes) }));
  const report = { generatedAt: new Date().toISOString(), totalBytes: total, totalHuman: formatBytes(total), count: chunks.length, top };
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'bundle-report.json'), JSON.stringify(report, null, 2));
  console.log('Bundle report written:', path.join(publicDir, 'bundle-report.json'));
}

main();
