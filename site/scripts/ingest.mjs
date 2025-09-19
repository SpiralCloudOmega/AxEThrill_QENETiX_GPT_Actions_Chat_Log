#!/usr/bin/env node
/**
 * Ingestion helper
 * Usage examples:
 *  node scripts/ingest.mjs dir ./external-dump --tag imported,ext
 *  node scripts/ingest.mjs file ./some-note.md --tag research
 *  node scripts/ingest.mjs glob "./captures/**/*.md" --tag capture
 *
 * Writes files into logs/incoming/ preserving original base name
 * Adds a leading heading if missing; optional frontmatter for tags.
 */
import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

const root = path.join(process.cwd(), '..');
const incomingDir = path.join(root, 'logs', 'incoming');
fs.mkdirSync(incomingDir, { recursive: true });

function parseArgs(){
  const args = process.argv.slice(2);
  if (!args.length) help();
  let mode = args.shift();
  const opts = { tags: [] };
  while (args.length) {
    const a = args.shift();
    if (a === '--tag' || a === '--tags') {
      const t = (args.shift() || '').split(/[, ]+/).filter(Boolean);
      opts.tags.push(...t);
    } else if (!opts.target) {
      opts.target = a;
    } else {
      console.error('Unexpected arg:', a); help(1);
    }
  }
  if (!mode || !opts.target) help(1);
  return { mode, ...opts };
}

function help(exitCode=0){
  console.log(`Usage:
  ingest.mjs dir <folder> [--tag tag1,tag2]
  ingest.mjs file <path.md> [--tag tag]
  ingest.mjs glob "pattern/**/*.md" [--tag t]
`);
  process.exit(exitCode);
}

function ensureTitle(md, filename){
  if (/^#\s+/m.test(md)) return md;
  const base = path.basename(filename, path.extname(filename));
  return `# ${base}\n\n` + md;
}

async function run(){
  const { mode, target, tags } = parseArgs();
  let files = [];
  if (mode === 'dir') {
    files = (await fg('**/*.md', { cwd: target, absolute: true }));
  } else if (mode === 'glob') {
    files = await fg(target, { absolute: true });
  } else if (mode === 'file') {
    files = [path.resolve(target)];
  } else {
    help(1);
  }
  if (!files.length) {
    console.error('No files found'); process.exit(2);
  }
  let count = 0;
  for (const f of files) {
    try {
      const raw = fs.readFileSync(f, 'utf8');
      const content = ensureTitle(raw, f);
      const name = path.basename(f);
      const out = path.join(incomingDir, name);
      let tagged = content;
      if (tags.length) {
        const fm = `---\ntags: ${tags.join(', ')}\n---\n\n`;
        if (!/^---\n/.test(content)) {
          tagged = fm + content;
        }
      }
      fs.writeFileSync(out, tagged, 'utf8');
      count++;
    } catch (e) {
      console.warn('Skip', f, e.message);
    }
  }
  console.log(`Ingested ${count} file(s) -> ${path.relative(root, incomingDir)}`);
}

run().catch(e => { console.error(e); process.exit(1); });
