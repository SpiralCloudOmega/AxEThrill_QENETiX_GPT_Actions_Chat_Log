"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUiConfig, withBase } from './NextUiConfig';
import CopyLink from './CopyLink';

type Chunk = {
  id: string;
  href: string;
  relPath: string;
  title: string;
  date: string;
  tags?: string[];
  snippet: string;
  vector: [string, number][];
  norm: number;
};

type DocVec = {
  href: string;
  title: string;
  date: string;
  relPath: string;
  vec: Map<string, number>;
  norm: number;
  tags?: string[];
};

function buildDocVectors(chunks: Chunk[]): Map<string, DocVec> {
  const docs = new Map<string, { href: string; title: string; date: string; count: number; sum: Map<string, number>; tags: Set<string> }>();
  for (const c of chunks) {
    const d = docs.get(c.relPath) || { href: c.href, title: c.title, date: c.date, count: 0, sum: new Map(), tags: new Set<string>() };
    d.count += 1;
    for (const [t, w] of c.vector) {
      d.sum.set(t, (d.sum.get(t) || 0) + w);
    }
    for (const t of (c.tags || [])) d.tags.add(t);
    // Keep the earliest href/title/date we saw (they should be consistent per relPath)
    if (!docs.has(c.relPath)) docs.set(c.relPath, d);
  }
  const out = new Map<string, DocVec>();
  for (const [rel, d] of docs.entries()) {
    const avg = new Map<string, number>();
    for (const [t, s] of d.sum) avg.set(t, s / Math.max(1, d.count));
    let sumsq = 0;
    for (const w of avg.values()) sumsq += w * w;
    const norm = Math.sqrt(sumsq) || 1;
    out.set(rel, { href: d.href, title: d.title, date: d.date, relPath: rel, vec: avg, norm, tags: Array.from(d.tags) });
  }
  return out;
}

function cosine(a: DocVec, b: DocVec): number {
  // sparse dot using the smaller map
  const [small, large] = a.vec.size <= b.vec.size ? [a.vec, b.vec] : [b.vec, a.vec];
  let dot = 0;
  for (const [t, wa] of small) {
    const wb = large.get(t);
    if (wb) dot += wa * wb;
  }
  return dot / (a.norm * b.norm);
}

export default function RelatedLogs({ currentRel, k, tagWeight }: { currentRel: string; k?: number; tagWeight?: number }) {
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cfg = useUiConfig();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
  const res = await fetch(withBase('/rag-index.json'), { cache: 'no-store' });
        if (!res.ok) throw new Error(`Index load failed: ${res.status}`);
        const data = await res.json();
        if (alive) setChunks(Array.isArray(data?.chunks) ? data.chunks : []);
      } catch (e: any) {
        if (alive) setError(e?.message || 'Failed to load index');
      }
    })();
    return () => { alive = false; };
  }, []);

  const related = useMemo(() => {
    if (!chunks || chunks.length === 0) return [] as DocVec[];
    const docs = buildDocVectors(chunks);
    const cur = docs.get(currentRel);
    if (!cur) return [];
    const curTags = new Set(cur.tags || []);
    const scored: { d: DocVec; s: number }[] = [];
    for (const [rel, d] of docs.entries()) {
      if (rel === currentRel) continue;
      const sim = cosine(cur, d);
      let boost = 0;
      if (curTags.size && d.tags && d.tags.length) {
        const other = new Set(d.tags);
        let inter = 0;
        for (const t of curTags) if (other.has(t)) inter++;
        const union = new Set([...Array.from(curTags), ...Array.from(other)]).size || 1;
        const jaccard = inter / union; // 0..1
  const tw = (tagWeight ?? (cfg && cfg.related ? cfg.related.tagWeight : undefined)) ?? 0.15;
  boost = jaccard * tw; // small boost
      }
      const s = sim + boost;
      if (s > 0) scored.push({ d, s });
    }
    scored.sort((a, b) => b.s - a.s);
  const K = k ?? (cfg && cfg.related ? cfg.related.k : 5);
    return scored.slice(0, K).map((x) => ({ ...x.d, score: x.s } as any));
  }, [chunks, currentRel, k, tagWeight, cfg]);

  if (error) return null;
  if (!chunks) return null;
  if (related.length === 0) return null;

  return (
    <aside style={{ margin: '16px 0' }}>
      <h3 style={{ margin: '8px 0' }}>Related logs</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {related.map((r: any) => (
          <li key={r.relPath} style={{ padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href={r.href} style={{ color: '#0ea5e9', textDecoration: 'none', flex: 1 }}>{r.title}</Link>
              <span title="similarity score" style={{ fontSize: 12, color: '#64748b' }}>{r.score?.toFixed?.(3)}</span>
              <CopyLink href={r.href} label="Copy" />
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{r.date} — {r.relPath}</div>
            {r.tags && r.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {r.tags.map((t: string) => (
                  <Link key={t} href={`/tags/${encodeURIComponent(t)}`} style={{ background: '#e2e8f0', color: '#0f172a', padding: '2px 8px', borderRadius: 999, fontSize: 12, textDecoration: 'none' }}>#{t}</Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
