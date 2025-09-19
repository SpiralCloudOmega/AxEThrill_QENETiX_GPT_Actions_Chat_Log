#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function isNumeric(x) {
  const n = Number(x);
  return Number.isFinite(n);
}

function stats(nums) {
  const n = nums.length;
  if (!n) return { count: 0 };
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const varp = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(varp);
  return { count: n, mean, min, max, std };
}

function topCounts(arr, k = 5) {
  const m = new Map();
  for (const v of arr) m.set(String(v), (m.get(String(v)) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k);
}

function parseCSV(text) {
  const rows = [];
  let i = 0;
  let row = [];
  let cell = '';
  let inQ = false;
  while (i < text.length) {
    const ch = text[i++];
    if (inQ) {
      if (ch === '"') {
        if (text[i] === '"') { cell += '"'; i++; } else { inQ = false; }
      } else { cell += ch; }
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell=''; }
      else if (ch === '\r') { /* skip */ }
      else { cell += ch; }
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function analyzeCSV(text) {
  const rows = parseCSV(text);
  if (rows.length === 0) return 'CSV: no rows';
  const header = rows[0];
  const data = rows.slice(1);
  const cols = header.length;
  const colSamples = header.map((h, idx) => data.slice(0, 5).map(r => r[idx]));
  const lines = [];
  lines.push(`CSV: ${data.length} rows, ${cols} columns`);
  header.forEach((h, idx) => {
    const col = data.map(r => r[idx]).filter(v => v !== undefined);
    const nums = col.map(Number).filter(Number.isFinite);
    const ratio = col.length ? (nums.length / col.length) : 0;
    if (ratio > 0.6) {
      const s = stats(nums);
      lines.push(`- ${h}: numeric ~${Math.round(ratio*100)}% -> count=${s.count}, mean=${s.mean.toFixed(3)}, min=${s.min}, max=${s.max}, std=${s.std.toFixed(3)}`);
    } else {
      const tops = topCounts(col).map(([v,c]) => `${v}(${c})`).join(', ');
      lines.push(`- ${h}: categorical -> top: ${tops}`);
    }
  });
  return lines.join('\n');
}

function analyzeJSON(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return 'Invalid JSON'; }
  if (Array.isArray(obj)) {
    const n = obj.length;
    const sample = obj[0] && typeof obj[0] === 'object' ? Object.keys(obj[0]) : [];
    const lines = [];
    lines.push(`JSON array: length=${n}`);
    if (sample.length) lines.push(`Sample keys: ${sample.slice(0, 20).join(', ')}`);
    if (n && typeof obj[0] === 'object') {
      const keys = new Set();
      for (const r of obj.slice(0, Math.min(200, n))) for (const k of Object.keys(r)) keys.add(k);
      lines.push(`Union of keys (first ${Math.min(200, n)} rows): ${[...keys].slice(0,50).join(', ')}`);
    }
    return lines.join('\n');
  } else if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj);
    return `JSON object: keys=${keys.length} -> ${keys.slice(0, 100).join(', ')}`;
  }
  return `JSON: primitive -> ${String(obj)}`;
}

function analyzeMD(text) {
  const lines = text.split('\n');
  const titles = lines.filter(l => /^#{1,6}\s+/.test(l)).map(l => l.replace(/^#+\s+/, '').trim());
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const sections = titles.length;
  return `Markdown: ${words} words, ${sections} sections. Headings: ${titles.slice(0,15).join(' | ')}`;
}

export function analyzeFile(fp) {
  const ext = path.extname(fp).toLowerCase();
  const text = read(fp);
  if (ext === '.csv') return analyzeCSV(text);
  if (ext === '.json') return analyzeJSON(text);
  if (ext === '.md' || ext === '.markdown' || ext === '.mdx') return analyzeMD(text);
  // fallback: generic summary
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return `Text file: ~${words} words`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fp = process.argv[2];
  if (!fp) { console.log('Usage: analyze.mjs <file>'); process.exit(2); }
  try { console.log(analyzeFile(fp)); } catch (e) { console.error('Analyze error:', e?.message || e); process.exit(1); }
}
