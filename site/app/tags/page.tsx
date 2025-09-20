import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
// import Link from 'next/link'; // (unused)
import dynamic from 'next/dynamic';
// const CopyLink = dynamic(() => import('../../components/CopyLink'), { ssr: false }); // (unused)
const TagsFilter = dynamic(() => import('./tags-filter'), { ssr: false });
const TopTags = dynamic(() => import('../../components/TopTags'), { ssr: false });
import { normalizeTags } from '../../scripts/lib/tags.mjs';

function logsRoot() {
  return path.join(process.cwd(), '..', 'logs');
}

function parseTags(md: string): string[] {
  const lines = md.split('\n');
  const fm: Record<string, string> = {};
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < Math.min(lines.length, 50); i++) {
      const line = lines[i];
      if (line.trim() === '---') break;
      const m = /^(\w[\w-]*):\s*(.*)$/.exec(line);
      if (m) fm[m[1].toLowerCase()] = m[2].trim();
    }
  }
  const first = lines.slice(0, 40).join('\n');
  const tagsStr = fm.tags || first.match(/Tags:\s*([^\n]+)/i)?.[1] || '';
  return normalizeTags(tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : []);
}

export default async function TagsIndex() {
  const root = logsRoot();
  if (!fs.existsSync(root)) {
    return <div>No logs yet.</div>;
  }
  const files = await fg('**/*.md', { cwd: root });
  const counts = new Map<string, number>();
  for (const rel of files) {
    const md = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const t of parseTags(md)) counts.set(t, (counts.get(t) || 0) + 1);
  }

  const tags = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <div>
  <h2>Tags <a href="/help" style={{ fontSize: 12, marginLeft: 8, textDecoration: 'none' }} title="Open Help">Help</a></h2>
      {tags.length === 0 && <p style={{ color: '#64748b' }}>No tags found yet.</p>}
      {tags.length > 0 && (
        <div style={{ margin: '8px 0 16px' }}>
          <TopTags tags={tags.map(([tag, count]) => ({ tag, count }))} />
        </div>
      )}
      <TagsFilter items={tags.map(([tag, count]) => ({ tag, count }))} />
    </div>
  );
}
