"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

export type Entry = {
  href: string;
  title: string;
  date: string;
  relPath: string;
  tags?: string[];
};

function normalize(s: string) {
  return s.toLowerCase();
}

export default function EntryList({ entries }: { entries: Entry[] }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [selected, setSelected] = useState<string[]>([]);
  const [visible, setVisible] = useState(50);
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem('favLogs') || '[]')); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('favLogs', JSON.stringify(favs)); } catch {}
  }, [favs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === '/') { e.preventDefault(); const el = document.querySelector<HTMLInputElement>('input[aria-label="Filter entries"]'); el?.focus(); }
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); setSort('title'); }
      if (e.key === 'Escape') { setQ(''); setSelected([]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) (e.tags || []).forEach((t) => set.add(t));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filtered = useMemo(() => {
    const nq = normalize(q);
    const list = entries.filter((e) => {
      const blob = `${e.title} ${e.date} ${e.relPath}`.toLowerCase();
      const textOk = !nq || blob.includes(nq);
      const hasTags = selected.length === 0 || selected.some((t) => (e.tags || []).includes(t));
      return textOk && hasTags;
    });

    return list.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'oldest') return a.relPath.localeCompare(b.relPath);
      return b.relPath.localeCompare(a.relPath);
    });
  }, [entries, q, sort]);

  function tagColor(tag: string) {
    // Simple hash to hue
    let h = 0; for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
    const hue = h % 360; const bg = `hsl(${hue} 70% 90%)`; const fg = `hsl(${hue} 40% 35%)`;
    return { bg, fg };
  }

  function download(text: string, filename: string, mime = 'text/plain') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadBundle(list: Entry[]) {
    // Concatenate raw markdowns of the filtered list into one .md file
    const repo = document.body.getAttribute('data-repo') || '';
    if (!repo) {
      alert('Repository info not available (data-repo)');
      return;
    }
    const owner = repo.split('/')[0];
    const name = repo.split('/')[1];
    const baseRaw = `https://raw.githubusercontent.com/${owner}/${name}/refs/heads/main/`;
    const parts: string[] = [];
    for (const e of list) {
      const rel = e.relPath; // logs/...md
      try {
        const res = await fetch(baseRaw + rel);
        if (res.ok) {
          const md = await res.text();
          parts.push(`\n\n---\n\n<!-- ${rel} -->\n\n` + md.trim() + '\n');
        }
      } catch {}
    }
    if (parts.length === 0) {
      alert('No files fetched.');
      return;
    }
    download(parts.join('\n'), 'bundle.md', 'text/markdown');
  }

  function toCSV(list: Entry[]) {
    const rows = [['title', 'date', 'relPath', 'href'], ...list.map(e => [e.title, e.date, e.relPath, e.href])];
    return rows
      .map(r => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(','))
      .join('\n');
  }

  const shown = filtered.slice(0, visible);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by text..."
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6 }}
          aria-label="Filter entries"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6 }}
          aria-label="Sort entries"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title">Title</option>
        </select>
        <button
          onClick={() => download(JSON.stringify(entries, null, 2), 'logs-index.json', 'application/json')}
          style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}
        >
          Download JSON
        </button>
        <button
          onClick={() => download(toCSV(filtered), 'logs.csv', 'text/csv')}
          style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}
        >
          Download CSV (filtered)
        </button>
        <button
          onClick={() => downloadBundle(filtered)}
          style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}
        >
          Download bundle (filtered)
        </button>
        {selected.length > 0 && (
          <button
            onClick={() => setSelected([])}
            style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}
          >
            Clear tags
          </button>
        )}
      </div>

      {allTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {allTags.map((t) => {
            const active = selected.includes(t);
            const c = tagColor(t);
            return (
              <button
                key={t}
                onClick={() => setSelected((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  border: '1px solid #cbd5e1',
                  background: active ? c.bg : 'white',
                  color: active ? c.fg : 'inherit',
                  cursor: 'pointer',
                }}
                aria-pressed={active}
              >
                #{t}
              </button>
            );
          })}
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {shown.map((e) => (
          <li key={e.href} style={{ padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
            <Link href={e.href} style={{ textDecoration: 'none', color: '#0ea5e9' }}>
              {e.title}
            </Link>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {e.date} — {e.relPath}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => { navigator.clipboard.writeText(location.origin + e.href + '/'); }}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: 12 }}
                title="Copy permalink"
              >
                Copy permalink
              </button>
              <button
                onClick={() => setFavs((cur) => (cur.includes(e.href) ? cur.filter((x) => x !== e.href) : [...cur, e.href]))}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: favs.includes(e.href) ? '#fde68a' : 'white', cursor: 'pointer', fontSize: 12 }}
                aria-pressed={favs.includes(e.href)}
              >
                {favs.includes(e.href) ? '★ Favorited' : '☆ Favorite'}
              </button>
              {favs.includes(e.href) && <span style={{ fontSize: 12, color: '#ca8a04' }}>Pinned</span>}
            </div>
            <div style={{ marginTop: 6 }}>
              <button
                onClick={() => setFavs((cur) => (cur.includes(e.href) ? cur.filter((x) => x !== e.href) : [...cur, e.href]))}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: favs.includes(e.href) ? '#fde68a' : 'white', cursor: 'pointer', fontSize: 12 }}
                aria-pressed={favs.includes(e.href)}
              >
                {favs.includes(e.href) ? '★ Favorited' : '☆ Favorite'}
              </button>
              {favs.includes(e.href) && <span style={{ fontSize: 12, color: '#ca8a04', marginLeft: 8 }}>Pinned</span>}
            </div>
            {e.tags && e.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {e.tags.map((t) => { const c = tagColor(t); return (
                  <span key={t} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 999, background: c.bg, color: c.fg }}>#{t}</span>
                );})}
              </div>
            )}
          </li>
        ))}
        {filtered.length === 0 && (
          <li style={{ color: '#64748b', padding: '12px 0' }}>No matches. Try a different query.</li>
        )}
      </ul>

      {shown.length < filtered.length && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setVisible((v) => v + 50)}
            style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}
          >
            Load more ({filtered.length - shown.length} more)
          </button>
        </div>
      )}
    </div>
  );
}
