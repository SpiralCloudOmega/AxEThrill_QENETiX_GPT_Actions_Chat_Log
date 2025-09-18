"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUiConfig, withBase } from './NextUiConfig';

type Policy = {
  generatedAt: string;
  topTags: { tag: string; count: number }[];
  tagNext: Record<string, { tag: string; count: number }[]>;
};

function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

export default function NextOptions({ contextTags = [] as string[] }: { contextTags?: string[] }){
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cfg = useUiConfig();

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
  const res = await fetch(withBase('/learn-policy.json'), { cache: 'no-store' });
        if (!res.ok) throw new Error(`policy ${res.status}`);
        const data = await res.json();
        if (ok) setPolicy(data);
      } catch (e: any) {
        if (ok) setError(e?.message || 'failed');
      }
    })();
    return () => { ok = false; };
  }, []);

  const suggestions = useMemo(() => {
    if (!policy) return [] as string[];
    const s = new Set<string>();
    for (const ct of contextTags) {
      for (const rec of policy.tagNext[ct] || []) s.add(rec.tag);
    }
    if (s.size === 0 && policy.topTags) {
      for (const t of policy.topTags.slice(0, cfg.nextOptions.fallbackTop)) s.add(t.tag);
    }
    return Array.from(s).slice(0, cfg.nextOptions.max);
  }, [policy, contextTags, cfg]);

  if (!policy || suggestions.length === 0) return null;
  return (
    <div style={{ margin: '8px 0 16px' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Next options</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {suggestions.map((t) => (
          <Link key={t} href={`/tags/${encodeURIComponent(t)}`} style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #cbd5e1', background: 'white', textDecoration: 'none' }}>#{t}</Link>
        ))}
      </div>
    </div>
  );
}
