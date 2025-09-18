"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Entry = { href: string; title: string; date: string; relPath: string; tags?: string[] };

export default function Favorites({ entries }: { entries: Entry[] }){
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem('favLogs') || '[]')); } catch {}
  }, []);

  const favEntries = useMemo(() => {
    const set = new Set(favs);
    return entries.filter(e => set.has(e.href));
  }, [entries, favs]);

  if (favEntries.length === 0) return null;

  function unpin(href: string){ setFavs(cur => cur.filter(x => x !== href)); }
  function clearAll(){ setFavs([]); try { localStorage.setItem('favLogs', '[]'); } catch {} }

  return (
    <div style={{ margin: '8px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>Favorites ({favEntries.length})</div>
        <button onClick={clearAll} style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 12 }}>Clear all</button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {favEntries.slice(0, 12).map((e) => (
          <li key={e.href} style={{ padding: '6px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <div>
              <Link href={e.href} style={{ color: '#0ea5e9', textDecoration: 'none' }}>{e.title}</Link>
              <div style={{ fontSize: 12, color: '#64748b' }}>{e.date} — {e.relPath}</div>
            </div>
            <div>
              <button onClick={() => unpin(e.href)} style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fde68a', cursor: 'pointer', fontSize: 12 }}>Unpin</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
