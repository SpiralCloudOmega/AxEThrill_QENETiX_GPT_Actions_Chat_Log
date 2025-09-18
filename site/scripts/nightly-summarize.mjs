#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');

function pickRandom(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

async function main(){
  const { addMemory, buildMemoryIndex } = await import('./tools/memory.mjs');
  const logsDir = path.join(repoRoot, 'logs');
  // find md files under logs
  const files = [];
  (function walk(dir){
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)){
      const fp = path.join(dir, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) walk(fp);
      else if (st.isFile() && /\.md$/i.test(name)) files.push(fp);
    }
  })(logsDir);
  if (files.length === 0){
    console.log('nightly-summarize: no logs found, skipping');
    return;
  }
  const fp = pickRandom(files);
  const rel = path.relative(repoRoot, fp);
  const md = fs.readFileSync(fp, 'utf8');
  // extract first H1 or fallback
  const title = (md.match(/^#\s+(.+)$/m)?.[1] || path.basename(fp));
  const snippet = md.split(/\n+/).slice(0, 40).join('\n');
  const content = snippet;
  const res = addMemory({ title: `Nightly: ${title}`, content, tags: ['nightly','summary'], source: rel, summary: `Auto summary of ${rel}` });
  buildMemoryIndex();
  console.log('nightly-summarize: added memory capsule', res.path);

  // Refresh learn-policy after adding memory capsule
  try {
    await import('./learn.mjs');
    console.log('nightly-summarize: refreshed learn-policy.json');
  } catch (e) {
    console.warn('nightly-summarize: failed to refresh learn-policy:', e?.message || e);
  }
}

main().catch((e)=>{ console.error('nightly-summarize failed:', e); process.exit(1); });
