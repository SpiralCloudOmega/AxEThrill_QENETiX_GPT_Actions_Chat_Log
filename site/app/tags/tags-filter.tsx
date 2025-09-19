"use client";

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import CopyLink from '../../components/CopyLink';

export type TagItem = { tag: string; count: number };

export default function TagsFilter({ items }: { items: TagItem[] }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Optional UX: focus with / like search page
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && (document.activeElement === document.body || !(document.activeElement as HTMLElement)?.isContentEditable)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setQ('');
        inputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((it) => it.tag.toLowerCase().includes(qq));
  }, [items, q]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter tags… (press / to focus)"
          style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        {q && (
          <button onClick={() => setQ('')} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
            Clear
          </button>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
        Showing {filtered.length} of {items.length} tags — Hotkeys: / focus, Esc clear. Each tag has Copy and an RSS Feed link.
      </div>
      {filtered.length === 0 ? (
        <div style={{ color: '#64748b' }}>No tags match “{q}”.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {filtered.map(({ tag, count }) => {
            const encoded = encodeURIComponent(tag);
            return (
              <li key={tag} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Link href={`/tags/${encoded}`} style={{ color: '#0ea5e9', textDecoration: 'none' }}>#{tag}</Link>
                  <span style={{ color: '#64748b' }}>({count})</span>
                </span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <CopyLink href={`/tags/${encoded}`} label="Copy" />
                  <Link href={`/tags/${encoded}/feed.xml`} style={{ color: '#0ea5e9', textDecoration: 'none', fontSize: 12 }}>Feed</Link>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
