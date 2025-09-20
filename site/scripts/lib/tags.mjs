import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');

export function normalizeTag(tag) {
  let s = String(tag || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  // Strip a single trailing punctuation token (common noise), but not hashes inside words.
  s = s.replace(/[\s]*[:;,.]$/,'');
  return s;
}

export function normalizeTags(arr) {
  const out = [];
  const seen = new Set();
  for (const t of arr || []) {
    const n = normalizeTag(t);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** Load tag alias map from public UI config if present. Keys and values are normalized. */
export function loadUiConfigTagAliases() {
  try {
    const cfgFile = path.join(siteDir, 'public', 'ui', 'config.json');
    if (!fs.existsSync(cfgFile)) return {};
    const raw = JSON.parse(fs.readFileSync(cfgFile, 'utf8')) || {};
    const aliases = raw.tagAliases || {};
    const out = {};
    for (const [k, v] of Object.entries(aliases)) {
      const nk = normalizeTag(k);
      const nv = normalizeTag(v);
      if (!nk || !nv) continue;
      if (nk === nv) continue; // ignore self-maps
      out[nk] = nv;
    }
    return out;
  } catch {
    return {};
  }
}

/** Map tags through alias table and dedupe; assumes inputs are normalized or will be normalized. */
export function applyTagAliases(tags, aliasMap) {
  const seen = new Set();
  const out = [];
  for (const t of tags || []) {
    const n = normalizeTag(t);
    const mapped = aliasMap && aliasMap[n] ? aliasMap[n] : n;
    if (!seen.has(mapped)) { seen.add(mapped); out.push(mapped); }
  }
  return out;
}
