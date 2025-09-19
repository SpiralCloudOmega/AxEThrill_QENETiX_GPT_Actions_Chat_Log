import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(process.cwd(), '..');
const incomingDir = path.join(repoRoot, 'logs', 'incoming');
const logsDir = path.join(repoRoot, 'logs');

function sanitize(s) {
  return (s || 'chat').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function parseMeta(md) {
  const first = md.split('\n').slice(0, 40).join('\n');
  const title = md.match(/^#\s*(.+)$/m)?.[1]?.trim() || 'Chat Transcript';
  const received = first.match(/Received At:\s*([^\n]+)/i)?.[1]?.trim();
  const id = first.match(/Conversation ID:\s*([^\n]+)/i)?.[1]?.trim();
  const tagsLine = first.match(/Tags:\s*([^\n]+)/i)?.[1];
  const tags = tagsLine ? tagsLine.split(',').map((t) => t.trim()).filter(Boolean) : [];
  return { title, received, id, tags };
}

function dateParts(meta) {
  const d = meta.received ? new Date(meta.received) : new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return { yyyy, mm, dd };
}

function ensureUnique(filepath) {
  if (!fs.existsSync(filepath)) return filepath;
  const dir = path.dirname(filepath);
  const base = path.basename(filepath, '.md');
  let i = 2;
  while (true) {
    const cand = path.join(dir, `${base}-${i}.md`);
    if (!fs.existsSync(cand)) return cand;
    i++;
  }
}

function routeOne(full) {
  const md = fs.readFileSync(full, 'utf8');
  const meta = parseMeta(md);
  const { yyyy, mm, dd } = dateParts(meta);
  const slug = sanitize(meta.title);
  const destDir = path.join(logsDir, yyyy, mm, dd);
  fs.mkdirSync(destDir, { recursive: true });
  let dest = path.join(destDir, `${slug}.md`);
  dest = ensureUnique(dest);

  // Ensure header has required fields
  let content = md;
  const hasTitle = /^#\s+/m.test(md);
  const hasId = /Conversation ID:/i.test(md);
  const hasRecv = /Received At:/i.test(md);
  let header = '';
  if (!hasTitle) header += `# ${meta.title}\n\n`;
  if (!hasId) header += `Conversation ID: ${meta.id || ''}\n`;
  if (!hasRecv) header += `Received At: ${meta.received || new Date().toISOString()}\n`;
  if (meta.tags && meta.tags.length && !/\nTags:/i.test(md)) header += `Tags: ${meta.tags.join(', ')}\n`;
  if (header) content = header + '\n' + md;

  fs.writeFileSync(dest, content);
  fs.unlinkSync(full);
  return dest;
}

function main() {
  if (!fs.existsSync(incomingDir)) {
    console.log('No incoming directory at', path.relative(repoRoot, incomingDir));
    return;
  }
  const files = fs.readdirSync(incomingDir).filter((f) => f.toLowerCase().endsWith('.md'));
  if (files.length === 0) {
    console.log('No incoming .md files to route.');
    return;
  }
  const moved = [];
  for (const f of files) {
    const src = path.join(incomingDir, f);
    const dest = routeOne(src);
    moved.push({ from: path.relative(repoRoot, src), to: path.relative(repoRoot, dest) });
  }
  console.log('Routed logs:', JSON.stringify(moved, null, 2));
}

main();
