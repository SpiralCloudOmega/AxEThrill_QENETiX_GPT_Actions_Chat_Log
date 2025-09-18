"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function RecentSearches(){
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('recentSearches') || '[]';
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setRecent(arr.filter(Boolean).slice(0, 10));
    } catch {}
  }, []);

  if (recent.length === 0) return null;
  return (
    <div style={{ margin: '8px 0 16px' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Recent searches</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {recent.map((r) => (
          <Link key={r} href={`/search?q=${encodeURIComponent(r)}`} style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #cbd5e1', background: 'white', textDecoration: 'none', fontSize: 12 }}>{r}</Link>
        ))}
        <button
          onClick={() => { try { localStorage.setItem('recentSearches', '[]'); setRecent([]); } catch {} }}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: 12 }}
        >Clear</button>
      </div>
    </div>
  );
}
