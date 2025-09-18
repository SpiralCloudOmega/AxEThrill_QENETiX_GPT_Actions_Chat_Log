import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');
const roots = [ path.join(repoRoot, 'logs'), path.join(repoRoot, 'site', 'public') ];
function isAllowed(fp){ const r=path.resolve(fp); return roots.some(root => r===root || r.startsWith(root+path.sep)); }

export function grepText({ pattern, file, flags = 'i' }){
  if (!pattern || !file) throw new Error('pattern and file required');
  const fp = path.isAbsolute(file) ? file : path.join(repoRoot, file);
  if (!isAllowed(fp)) throw new Error('Path not allowed');
  if (!fs.existsSync(fp)) throw new Error('No such file');
  const re = new RegExp(pattern, flags);
  const lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/);
  const out = [];
  for (let i=0;i<lines.length;i++){
    const L = lines[i];
    if (re.test(L)) out.push({ line: i+1, text: L.slice(0, 500) });
  }
  return { matches: out, count: out.length, file: path.relative(repoRoot, fp) };
}
