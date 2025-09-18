"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import CopyLink from '../../components/CopyLink';
import { useToast } from '../../components/Toast';
import { useUiConfig, withBase } from '../../components/NextUiConfig';

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

function tokenize(text: string) {
  const STOP = new Set('the,of,and,to,in,a,for,is,that,on,with,as,it,by,from,at,be,an,or,are,this,was,will,can,not,have,has,had,if,then,else,do,does,did,than,which,into,over,under,between,within,without,about,after,before,since,per,each,via'.split(','));
  return (text.toLowerCase().match(/[a-z0-9_]+/g) || []).filter((t) => t.length > 1 && !STOP.has(t));
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [idf, setIdf] = useState<Record<string, number>>({});
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [activeTag, setActiveTag] = useState<string>('');
  const cfg = useUiConfig();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
  const res = await fetch(withBase('/rag-index.json'), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (alive) {
            setIdf(data.idf || {});
            setChunks(data.chunks || []);
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('recentSearches') || '[]';
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setRecent(arr.filter(Boolean).slice(0, 10));
    } catch {}
    // read ?q= from URL on mount
    try {
      const url = new URL(window.location.href);
      const qp = url.searchParams.get('q');
      if (qp) {
        setQ(qp);
        // also save to recent immediately
        const t = qp.trim();
        if (t) {
          const next = [t, ...recent.filter((x) => x !== t)].slice(0, 10);
          setRecent(next);
          localStorage.setItem('recentSearches', JSON.stringify(next));
        }
      }
    } catch {}
  }, []);

  function saveRecent(term: string) {
    try {
      const t = term.trim();
      if (!t) return;
      const next = [t, ...recent.filter((x) => x !== t)].slice(0, 10);
      setRecent(next);
      localStorage.setItem('recentSearches', JSON.stringify(next));
    } catch {}
  }

  const allResults = useMemo(() => {
    if (!q.trim()) return [] as (Chunk & { score: number })[];
    const terms = tokenize(q);
    if (terms.length === 0) return [] as any[];
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);
    const weights: [string, number][] = [];
    let sumsq = 0;
    for (const [t, f] of tf) {
      const w = f * (idf[t] || 1);
      if (w > 0) { weights.push([t, w]); sumsq += w * w; }
    }
    const qnorm = Math.sqrt(sumsq) || 1;
    const scores: { i: number; s: number }[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      let dot = 0;
      // sparse dot product
      for (const [t, wq] of weights) {
        const cw = c.vector.find((x) => x[0] === t)?.[1];
        if (cw) dot += wq * cw;
      }
      const score = dot / (qnorm * (c.norm || 1));
      if (score > 0) scores.push({ i, s: score });
    }
    scores.sort((a, b) => b.s - a.s);
    return scores.slice(0, cfg.search.maxResults).map(({ i, s }) => ({ ...chunks[i], score: s }));
  }, [q, chunks, idf, cfg]);

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of allResults) {
      for (const t of r.tags || []) m.set(t, (m.get(t) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);
  }, [allResults]);

  const results = useMemo(() => {
    if (!activeTag) return allResults;
    return allResults.filter((r) => (r.tags || []).includes(activeTag));
  }, [allResults, activeTag]);

  return (
    <div>
  <h2 style={{ marginTop: 0 }}>Search <a href="/help" style={{ fontSize: 12, marginLeft: 8, textDecoration: 'none' }} title="Open Help">Help</a></h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search logs (TF‑IDF cosine) — Hotkeys: / or s focus, Esc clear, Enter open top"
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6 }}
        />
        <a href="/rag-capsule.png" download style={{ color: '#0ea5e9', textDecoration: 'none' }} title="PNG diagram of the retrieval capsule">Download capsule</a>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
        Results are ranked by TF‑IDF cosine similarity. Higher score ≈ more relevant. Recent searches are saved locally.
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
        Hotkeys: / or s focus, Esc clear, Enter opens the top result.
      </div>
      {tagCounts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '-6px 0 12px' }}>
          <button
            onClick={() => setActiveTag('')}
            style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #cbd5e1', background: activeTag === '' ? '#0ea5e9' : 'white', color: activeTag === '' ? '#fff' : '#0f172a', cursor: 'pointer', fontSize: 12 }}
            title="Show all results"
          >All</button>
          {tagCounts.slice(0, cfg.search.maxTagChips).map(([t, n]) => (
            <button
              key={t}
              onClick={() => setActiveTag(t)}
              title={`${n} results`}
              style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #cbd5e1', background: activeTag === t ? '#0ea5e9' : 'white', color: activeTag === t ? '#fff' : '#0f172a', cursor: 'pointer', fontSize: 12 }}
            >#{t}</button>
          ))}
        </div>
      )}
      {recent.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: -8, marginBottom: 16 }}>
          {recent.map((r) => (
            <button key={r} onClick={() => setQ(r)} style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: 12 }}>{r}</button>
          ))}
          <button onClick={() => { setRecent([]); localStorage.setItem('recentSearches', '[]'); }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: 12 }}>Clear</button>
        </div>
      )}
  <Hotkeys inputRef={inputRef} topHref={results[0]?.href} onEnter={() => saveRecent(q)} />
      {loading && <div style={{ color: '#64748b' }}>Loading index…</div>}
      {!loading && results.length === 0 && <div style={{ color: '#64748b' }}>Type to search. Results will appear here.</div>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {results.map((r) => (
          <li key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
            <Link href={r.href} style={{ color: '#0ea5e9', textDecoration: 'none' }}>{r.title}</Link>
            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{r.date} — {r.relPath} — score {r.score.toFixed(3)}</span>
              <span style={{ marginLeft: 'auto' }}>
                <CopyLink href={r.href} label="Copy" />
                <button
                  onClick={async () => {
                    try {
                      const url = location.origin + r.href;
                      const md = `[${r.title}](${url})`;
                      await navigator.clipboard.writeText(md);
                      try { toast('Markdown copied', { type: 'success' }); } catch {}
                    } catch {
                      try { toast('Copy failed', { type: 'error' }); } catch {}
                    }
                  }}
                  style={{ marginLeft: 6, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: 12 }}
                >Copy MD</button>
              </span>
            </div>
            {(r.tags && r.tags.length > 0) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {r.tags.map((t: string) => {
                  const href = `/tags/${encodeURIComponent(t)}`;
                  return (
                    <Link key={t} href={href} style={{ background: '#e2e8f0', color: '#0f172a', padding: '2px 8px', borderRadius: 999, fontSize: 12, textDecoration: 'none' }}>#{t}</Link>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#334155', marginTop: 6 }}>{r.snippet}…</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Hotkeys({ inputRef, topHref, onEnter }: { inputRef: any; topHref?: string; onEnter?: () => void }){
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const k = e.key.toLowerCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (k === 'escape') {
          (e.target as HTMLInputElement).value = '';
          (e.target as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));
        } else if (k === 'enter' && topHref) {
          e.preventDefault();
          try { onEnter?.(); } catch {}
          window.location.assign(topHref);
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === '/' || k === 's') {
        e.preventDefault();
        inputRef?.current?.focus?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inputRef, topHref, onEnter]);
  return null;
}
