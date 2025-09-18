"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CopyLink from './CopyLink';

type Item = { href: string; title: string; relPath: string; viewedAt: string };

export default function RecentlyViewed() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('recentlyViewedLogs') || '[]';
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setItems(arr);
    } catch {}
  }, []);

  if (items.length === 0) return null;
  return (
    <div style={{ margin: '8px 0 16px' }}>
      <h3 style={{ margin: '8px 0' }}>Recently viewed</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((it) => (
          <li key={it.href} style={{ padding: '6px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href={it.href} style={{ color: '#0ea5e9', textDecoration: 'none', flex: 1 }}>{it.title}</Link>
            <span style={{ color: '#64748b', fontSize: 12 }}>{it.relPath}</span>
            <CopyLink href={it.href} label="Copy" />
          </li>
        ))}
      </ul>
    </div>
  );
}
