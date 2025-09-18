import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import nextDynamic from 'next/dynamic';
const CopyLink = nextDynamic(() => import('../../../components/CopyLink'), { ssr: false });
const NextOptions = nextDynamic(() => import('../../../components/NextOptions'), { ssr: false });
import { normalizeTags } from '../../../scripts/lib/tags.mjs';

function logsRoot() {
  return path.join(process.cwd(), '..', 'logs');
}

function parseHeader(md: string) {
  const lines = md.split('\n');
  let fm: Record<string, string> = {};
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < Math.min(lines.length, 50); i++) {
      const line = lines[i];
      if (line.trim() === '---') break;
      const m = /^(\w[\w-]*):\s*(.*)$/.exec(line);
      if (m) fm[m[1].toLowerCase()] = m[2].trim();
    }
  }
  const first = lines.slice(0, 40).join('\n');
  const titleMatch = md.match(/^#\s*(.+)$/m) || (fm.title ? [null, fm.title] as any : null);
  const tagsStr = fm.tags || first.match(/Tags:\s*([^\n]+)/i)?.[1] || '';
  const tags = normalizeTags(tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : []);
  return {
    title: titleMatch?.[1]?.trim() ?? 'Chat Transcript',
    tags
  };
}

export async function generateStaticParams() {
  const root = logsRoot();
  if (!fs.existsSync(root)) return [];
  const files = await fg('**/*.md', { cwd: root });
  const set = new Set<string>();
  for (const rel of files) {
    const md = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const t of parseHeader(md).tags) set.add(t);
  }
  return Array.from(set).map((tag) => ({ tag }));
}

export const dynamic = 'error';
export const dynamicParams = false;

export default async function TagPage({ params }: { params: { tag: string } }) {
  const tag = normalizeTags([params.tag])[0] || params.tag;
  const root = logsRoot();
  if (!fs.existsSync(root)) notFound();
  const files = await fg('**/*.md', { cwd: root });
  const items = files.map((rel) => {
    const full = path.join(root, rel);
    const md = fs.readFileSync(full, 'utf8');
    const meta = parseHeader(md);
    return { rel, title: meta.title, has: meta.tags.includes(tag) };
  }).filter((x) => x.has);

  if (items.length === 0) notFound();

  items.sort((a, b) => a.rel.localeCompare(b.rel));

  return (
    <div>
  <h2>Tag: #{tag} <a href="/help" style={{ fontSize: 12, marginLeft: 8, textDecoration: 'none' }} title="Open Help">Help</a></h2>
      <NextOptions contextTags={[tag]} />
      <div style={{ fontSize: 14, marginBottom: 12 }}>
        <a href={`/tags/${encodeURIComponent(tag)}/feed.xml`} style={{ color: '#0ea5e9', textDecoration: 'none' }}>RSS feed for #{tag}</a>
        <span style={{ marginLeft: 8 }}>
          <CopyLink href={`/tags/${encodeURIComponent(tag)}`} label="Copy link" />
        </span>
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((e) => {
          const href = '/logs/' + e.rel.replace(/\.md$/i, '').split(path.sep).join('/');
          return (
            <li key={e.rel} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link href={href} style={{ color: '#0ea5e9', textDecoration: 'none', flex: 1 }}>{e.title}</Link>
                <CopyLink href={href} label="Copy" />
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{e.rel}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
