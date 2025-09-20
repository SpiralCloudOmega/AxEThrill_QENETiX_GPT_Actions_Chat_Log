import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import Link from 'next/link';
import EntryList, { type Entry } from '../components/EntryList';
import dynamic from 'next/dynamic';
import RandomLog from '../components/RandomLog';
const ActivityHeatmap = dynamic(() => import('../components/ActivityHeatmap'), { ssr: false });
import HomeHotkeys from '../components/HomeHotkeys';
import dynamicTop from 'next/dynamic';
const TopTags = dynamicTop(() => import('../components/TopTags'), { ssr: false });
const Favorites = dynamicTop(() => import('../components/Favorites'), { ssr: false });
const RecentlyViewed = dynamicTop(() => import('../components/RecentlyViewed'), { ssr: false });
const NextOptions = dynamicTop(() => import('../components/NextOptions'), { ssr: false });
const RecentSearches = dynamicTop(() => import('../components/RecentSearches'), { ssr: false });

// Using Entry type from components

function parseHeader(md: string) {
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
  const idMatch = first.match(/Conversation ID:\s*(.+)/i) || (fm.id ? [null, fm.id] as any : null);
  const receivedMatch = first.match(/Received At:\s*([^\n]+)/i) || (fm.receivedat ? [null, fm.receivedat] as any : null) || (fm.date ? [null, fm.date] as any : null);
  const titleMatch = md.match(/^#\s*(.+)$/m) || (fm.title ? [null, fm.title] as any : null);
  const tagsStr = fm.tags || first.match(/Tags:\s*([^\n]+)/i)?.[1] || '';
  const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];

  return {
    id: idMatch?.[1]?.trim() ?? '',
    receivedAt: receivedMatch?.[1]?.trim() ?? '',
    title: titleMatch?.[1]?.trim() ?? 'Chat Transcript',
    tags
  };
}

function getLogsDir() {
  return path.join(process.cwd(), '..', 'logs');
}

function toSlug(rel: string) {
  const noExt = rel.replace(/\.md$/i, '');
  const parts = noExt.split(path.sep).slice(1);
  return parts;
}

export default async function Page() {
  const logsDir = getLogsDir();
  const exists = fs.existsSync(logsDir);
  let entries: Entry[] = [];
  let topTags: { tag: string; count: number }[] = [];

  if (exists) {
    const files = await fg('logs/**/*.md', { cwd: path.join(process.cwd(), '..') });
    entries = files.map((relPath) => {
      const full = path.join(process.cwd(), '..', relPath);
      const md = fs.readFileSync(full, 'utf8');
      const meta = parseHeader(md);

      const slugParts = toSlug(relPath);
      const href = '/logs/' + slugParts.join('/');

      const [yyyy, mm, dd] = slugParts;
      const date = yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : meta.receivedAt;

      const entry: Entry = {
        href,
        title: meta.title || `Transcript ${relPath}`,
        date,
        relPath,
        tags: meta.tags
      };
      return entry;
    });

    entries.sort((a, b) => b.relPath.localeCompare(a.relPath));

    // Build simple tag cloud (top 12)
    const tagCounts = new Map<string, number>();
    for (const e of entries) {
      for (const t of e.tags || []) {
        const key = t.trim();
        if (!key) continue;
        tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
      }
    }
    topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 12);
  }

  return (
    <div>
  <h2 style={{ marginTop: 0 }}>All conversations <a href="/help" style={{ fontSize: 12, marginLeft: 8, textDecoration: 'none' }} title="Open Help">Help</a></h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 16px' }}>
        <Link href="/ai" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>AI</Link>
        <Link href="/agents" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>Agents</Link>
        <Link href="/memory" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>Memory</Link>
        <Link href="/search" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>Search</Link>
        <Link href="/tags" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>Tags</Link>
        <a href="/feed.xml" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>RSS</a>
      </div>
      <div style={{ color: '#64748b', fontSize: 12, margin: '-6px 0 10px' }}>Hotkeys: / or s = Search, a = AI, g = Agents, m = Memory, r = random log, t = top</div>
      {exists && entries.length > 0 && (
        <div style={{ margin: '8px 0 16px' }}>
          <ActivityHeatmap items={entries} />
        </div>
      )}
      {exists && entries.length > 0 && (
        <Favorites entries={entries} />
      )}
      <RecentSearches />
      <RecentlyViewed />
      <NextOptions />
      {exists && topTags.length > 0 && (
        <TopTags tags={topTags} />
      )}
      <div style={{ margin: '8px 0 16px' }}>
        {exists && entries.length > 0 && <RandomLog paths={entries.map((e) => e.relPath.replace(/^logs\//, ''))} />}
      </div>
      {!exists && (
        <p>
          No logs directory found. Once your webhook or GPT Action writes to <code>logs/</code>, rebuild the site.
        </p>
      )}
      <EntryList entries={entries} />
      <HomeHotkeys hrefs={entries.map((e) => e.href)} />
    </div>
  );
}