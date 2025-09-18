#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { fileURLToPath } from 'node:url';
import { normalizeTags, loadUiConfigTagAliases, applyTagAliases } from './lib/tags.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');
const logsDir = path.join(repoRoot, 'logs');
const outFile = path.join(siteDir, 'public', 'learn-policy.json');

// Load aliases once
const TAG_ALIASES = loadUiConfigTagAliases();

function parseTags(md) {
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
  const first = lines.slice(0, 40).join('\n');
  const tagsStr = fm.tags || (first.match(/Tags:\s*([^\n]+)/i)?.[1] || '');
  const norm = normalizeTags(tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : []);
  return applyTagAliases(norm, TAG_ALIASES);
}

async function main() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), topTags: [], tagNext: {}, pairCounts: {} }, null, 2));
    console.log('No logs found. Wrote empty policy to', path.relative(siteDir, outFile));
    return;
  }
  const files = await fg('**/*.md', { cwd: logsDir });
  const tagCounts = new Map();
  const pairCounts = new Map(); // key: a|b (sorted)
  const nextMap = new Map(); // tag -> Map<otherTag,count>

  for (const rel of files) {
  const md = fs.readFileSync(path.join(logsDir, rel), 'utf8');
    const tags = Array.from(new Set(parseTags(md)));
    for (const t of tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    // co-occurrence within a document
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const [a, b] = tags[i] < tags[j] ? [tags[i], tags[j]] : [tags[j], tags[i]];
        const key = `${a}|${b}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        // directional suggestions: for a, suggest b and vice versa
        const ma = nextMap.get(a) || new Map();
        ma.set(b, (ma.get(b) || 0) + 1);
        nextMap.set(a, ma);
        const mb = nextMap.get(b) || new Map();
        mb.set(a, (mb.get(a) || 0) + 1);
        nextMap.set(b, mb);
      }
    }
  }

  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 50)
    .map(([tag, count]) => ({ tag, count }));

  const tagNext = {};
  for (const [tag, m] of nextMap.entries()) {
    const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([t, c]) => ({ tag: t, count: c }));
    tagNext[tag] = arr;
  }
  const pairCountsObj = Object.fromEntries(Array.from(pairCounts.entries()));

  const policy = {
    generatedAt: new Date().toISOString(),
    topTags,
    tagNext,
    pairCounts: pairCountsObj
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(policy, null, 2));
  console.log('Learned policy written to', path.relative(siteDir, outFile), JSON.stringify({ topTags: topTags.length, tagNext: Object.keys(tagNext).length }, null, 0));
}

main().catch((e) => {
  console.error('learn.mjs failed:', e);
  process.exit(1);
});
