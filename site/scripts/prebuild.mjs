/* eslint-disable no-inner-declarations */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';
import { execSync } from 'node:child_process';
import { normalizeTags, loadUiConfigTagAliases, applyTagAliases } from './lib/tags.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');
const logsDir = path.join(repoRoot, 'logs');
const publicDir = path.join(siteDir, 'public');

function parseHeader(md) {
  const lines = md.split('\n');
  let _offset = 0; // retained for potential future slice usage
  const fm = {};
  if (lines[0]?.trim() === '---') {
    // Simple YAML-like frontmatter: key: value per line until closing ---
    for (let i = 1; i < Math.min(lines.length, 50); i++) {
      const line = lines[i];
  if (line.trim() === '---') { _offset = i + 1; break; }
      const m = /^(\w[\w-]*):\s*(.*)$/.exec(line);
      if (m) {
        const key = m[1].toLowerCase();
        const val = m[2].trim();
        fm[key] = val;
      }
    }
  }
  const head = lines.slice(0, 40).join('\n');
  const idMatch = head.match(/Conversation ID:\s*(.+)/i) || (fm.id ? [null, fm.id] : null);
  const receivedMatch = head.match(/Received At:\s*([^\n]+)/i) || (fm.receivedat ? [null, fm.receivedat] : null) || (fm.date ? [null, fm.date] : null);
  const titleMatch = md.match(/^#\s*(.+)$/m) || (fm.title ? [null, fm.title] : null);
  const tagsFromHead = head.match(/Tags:\s*([^\n]+)/i)?.[1];
  const tagsStr = fm.tags || tagsFromHead || '';
  const rawTags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const norm = normalizeTags(rawTags);
  const aliases = loadUiConfigTagAliases();
  const tags = applyTagAliases(norm, aliases);
  return {
    id: idMatch?.[1]?.trim() ?? '',
    receivedAt: receivedMatch?.[1]?.trim() ?? '',
    title: titleMatch?.[1]?.trim() ?? 'Chat Transcript',
    tags
  };
}

async function run() {
  // Build learn-policy (next options) first so it's present even if logs/ is missing
  try {
    await import('./learn.mjs');
  } catch (e) {
    console.warn('Skipping learn-policy generation:', e?.message || e);
  }

  if (!fs.existsSync(logsDir)) {
    console.log('No logs directory found, skipping prebuild.');
    return;
  }
  fs.mkdirSync(publicDir, { recursive: true });

  const files = await fg('**/*.md', { cwd: logsDir });
  const entries = files.map((rel) => {
    const full = path.join(logsDir, rel);
    const md = fs.readFileSync(full, 'utf8');
    const meta = parseHeader(md);
    const slugParts = rel.replace(/\.md$/i, '').split(path.sep);
    const href = '/logs/' + slugParts.join('/');
    const [yyyy, mm, dd] = slugParts;
    const date = yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : meta.receivedAt;
  return { href, title: meta.title || rel, date, relPath: `logs/${rel}`, tags: meta.tags };
  });

  entries.sort((a, b) => b.relPath.localeCompare(a.relPath));

  // Write JSON index
  fs.writeFileSync(path.join(publicDir, 'logs-index.json'), JSON.stringify(entries, null, 2));

  // Minimal RSS feed
  const base = process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY
    ? `https://${process.env.GITHUB_REPOSITORY.split('/')[0]}.github.io/${process.env.GITHUB_REPOSITORY.split('/')[1]}`
    : 'http://localhost:3000';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Chat Logs</title>
    <link>${base}/</link>
    <description>Browse GPT chat transcripts from this repo</description>
    ${entries.map((e) => `
    <item>
      <title>${e.title}</title>
      <link>${base}${e.href}/</link>
      <guid>${base}${e.href}/</guid>
      <pubDate>${new Date(e.date || Date.now()).toUTCString()}</pubDate>
      <description>${e.relPath}</description>
    </item>`).join('')}
  </channel>
</rss>`;
  fs.writeFileSync(path.join(publicDir, 'feed.xml'), xml);

  // Per-tag RSS feeds
  const byTag = new Map();
  for (const e of entries) {
    for (const t of e.tags || []) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t).push(e);
    }
  }
  for (const [tag, list] of byTag.entries()) {
    const tagDir = path.join(publicDir, 'tags', tag);
    fs.mkdirSync(tagDir, { recursive: true });
    const txml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>#${tag} - Chat Logs</title>
    <link>${base}/tags/${encodeURIComponent(tag)}/</link>
    <description>Items tagged ${tag}</description>
    ${list.map((e) => `
    <item>
      <title>${e.title}</title>
      <link>${base}${e.href}/</link>
      <guid>${base}${e.href}/</guid>
      <pubDate>${new Date(e.date || Date.now()).toUTCString()}</pubDate>
      <description>${e.relPath}</description>
    </item>`).join('')}
  </channel>
</rss>`;
    fs.writeFileSync(path.join(tagDir, 'feed.xml'), txml);
  }

  // Optional: generate git commit data (best-effort)
  try {
    const isRepo = execSync('git rev-parse --is-inside-work-tree', { cwd: repoRoot, encoding: 'utf8' }).trim() === 'true';
    if (isRepo) {
      const limit = Number(process.env.GIT_GRAPH_LIMIT || 300);
      const log = execSync(`git log --date=iso '--pretty=format:%H|%P|%an|%ad|%s' -n ${limit}`,
        { cwd: repoRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
      const commits = log.split('\n').filter(Boolean).map((l) => {
        const [hash, parents, author, date, ...rest] = l.split('|');
        const subject = rest.join('|');
        return { hash, parents: (parents || '').split(' ').filter(Boolean), author, date, subject };
      });
      fs.writeFileSync(path.join(publicDir, 'commits.json'), JSON.stringify(commits, null, 2));
      // File changes for most recent N commits (smaller)
      const changesLimit = Math.min(100, commits.length);
      const filesMap = {};
      for (let i = 0; i < changesLimit; i++) {
        const h = commits[i].hash;
        try {
          const files = execSync(`git show --name-only --pretty=format: ${h}`, { cwd: repoRoot, encoding: 'utf8' })
            .split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('commit '));
          filesMap[h] = files;
        } catch {}
      }
      fs.writeFileSync(path.join(publicDir, 'commit-files.json'), JSON.stringify(filesMap, null, 2));
    }
  } catch (e) {
    console.warn('Skipping git graph generation:', e?.message || e);
  }

  // Optional: generate repo file tree (ignore heavy dirs)
  try {
    const ignore = ['.git', 'node_modules', 'out', 'dist', 'build', '.next'];
    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const children = [];
      for (const ent of entries) {
        if (ignore.includes(ent.name)) continue;
        const full = path.join(dir, ent.name);
        const rel = path.relative(repoRoot, full);
        if (rel.startsWith('..')) continue;
        if (ent.isDirectory()) {
          children.push({ name: ent.name, type: 'dir', path: rel, children: walk(full) });
        } else if (ent.isFile()) {
          const stat = fs.statSync(full);
          const ext = path.extname(ent.name).slice(1);
          children.push({ name: ent.name, type: 'file', path: rel, size: stat.size, ext });
        }
      }
      return children;
    }
    const tree = walk(repoRoot);
    fs.writeFileSync(path.join(publicDir, 'repo-tree.json'), JSON.stringify(tree, null, 2));
  } catch (e) {
    console.warn('Skipping repo tree generation:', e?.message || e);
  }

    // Build RAG index and PNG capsule
    try {
      await import('./build-rag.mjs');
    } catch (e) {
      console.warn('Skipping RAG build:', e?.message || e);
    }

  // Build Memory index (for /memory UI)
  try {
    const mem = await import('./tools/memory.mjs');
    if (mem && typeof mem.buildMemoryIndex === 'function') {
      const res = mem.buildMemoryIndex();
      console.log(`Memory index built: ${res.count} items -> ${res.path}`);
    }
  } catch (e) {
    console.warn('Skipping memory index build:', e?.message || e);
  }

  // health.json meta summary
  try {
  const health = {};
  // Version marker (bump if structure changes materially)
  health.version = 2;
    health.generatedAt = new Date().toISOString();
    // current commit
    try {
      health.commit = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
      health.shortCommit = health.commit.slice(0, 12);
    } catch {}
    health.logs = entries.length;
    // unique tags
    const tagSet = new Set();
    entries.forEach(e => (e.tags || []).forEach(t => tagSet.add(t)));
    health.uniqueTags = tagSet.size;
    // rag index stats (if exists)
    try {
      const ragPath = path.join(publicDir, 'rag-index.json');
      if (fs.existsSync(ragPath)) {
        const rag = JSON.parse(fs.readFileSync(ragPath, 'utf8'));
        health.rag = { chunks: rag.chunks?.length || rag.chunksCount || 0, terms: rag.idf ? Object.keys(rag.idf).length : undefined };
      }
    } catch {}
    // memory index stats
    try {
      const memPath = path.join(publicDir, 'memory-index.json');
      if (fs.existsSync(memPath)) {
        const mem = JSON.parse(fs.readFileSync(memPath, 'utf8'));
        health.memory = { items: mem.items?.length || mem.count || 0 };
      }
    } catch {}
    // commit files counts
    try {
      const commitsPath = path.join(publicDir, 'commits.json');
      if (fs.existsSync(commitsPath)) {
        const commits = JSON.parse(fs.readFileSync(commitsPath, 'utf8'));
        health.commits = commits.length;
      }
    } catch {}
    // Feature flags snapshot for quick capability introspection
    health.featureFlags = {
      providerSummarize: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY),
      rateLimitPersistence: true,
      mcpWriteMethods: true
    };
    fs.writeFileSync(path.join(publicDir, 'health.json'), JSON.stringify(health, null, 2));
    // Also write a super-light ping.json for uptime checks
    const ping = {
      ok: true,
      shortCommit: health.shortCommit,
      generatedAt: health.generatedAt
    };
    fs.writeFileSync(path.join(publicDir, 'ping.json'), JSON.stringify(ping));
  } catch (e) {
    console.warn('Failed to write health.json:', e?.message || e);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
