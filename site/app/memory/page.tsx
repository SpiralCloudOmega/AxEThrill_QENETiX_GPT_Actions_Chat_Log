"use client";
import { useEffect, useMemo, useState } from 'react';
import { withBase } from '../../components/NextUiConfig';

type MemoryItem = {
  id: string;
  ts: string;
  title: string;
  tags?: string[];
  source?: string;
  summary?: string;
  snippet?: string;
  file?: string;
};

export const dynamic = 'error';
export const dynamicParams = false;

export default function MemoryPage() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [q, setQ] = useState('');
  const [activeTag, setActiveTag] = useState('');

  useEffect(() => {
    let ok = true;
  fetch(withBase('/memory-index.json')).then(r=>r.ok?r.json():[]).then((data) => { if (ok) setItems(Array.isArray(data)?data:[]); }).catch(()=>{});
    return () => { ok = false; };
  }, []);

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      for (const t of (it.tags||[])) m.set(t, (m.get(t)||0)+1);
    }
    return Array.from(m.entries()).sort((a,b)=> b[1]-a[1]).slice(0, 50);
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return items.filter(it => {
      if (activeTag && !(it.tags||[]).includes(activeTag)) return false;
      if (!s) return true;
      const hay = [it.title, it.summary, it.snippet, (it.tags||[]).join(' ')].join(' ').toLowerCase();
      return hay.includes(s);
    });
  }, [items, q, activeTag]);

  return (
    <div>
  <h2 style={{ marginTop: 0 }}>Memory <a href="/help" style={{ fontSize: 12, marginLeft: 8, textDecoration: 'none' }} title="Open Help">Help</a></h2>
      <p>
        JSON memory capsules indexed for quick browsing and recall. Use search or click a tag. 
        Want to add one quickly? Try the <a href="/ui/clip/">Clip</a> mini‑UI.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input placeholder="search…" value={q} onChange={e=>setQ(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #cbd5e1', minWidth: 260 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={()=>setActiveTag('')} style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid #cbd5e1', background: activeTag===''?'#0ea5e9':'#f8fafc', color: activeTag===''?'#fff':'#0f172a' }}>All</button>
          {tags.map(([t,n]) => (
            <button key={t} onClick={()=>setActiveTag(t)} title={`${n} items`} style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid #cbd5e1', background: activeTag===t?'#0ea5e9':'#f8fafc', color: activeTag===t?'#fff':'#0f172a' }}>#{t}</button>
          ))}
        </div>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {filtered.map((it) => (
          <li key={it.id} style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ margin: '4px 0' }}>{it.title || '(untitled)'}</h3>
              <small style={{ color: '#64748b' }}>{new Date(it.ts).toLocaleString()}</small>
            </div>
            {it.source && (
              <div style={{ margin: '4px 0 8px 0' }}>
                <small>Source: {/^https?:/i.test(it.source) ? <a href={it.source} target="_blank" rel="noreferrer">{it.source}</a> : <code>{it.source}</code>}</small>
              </div>
            )}
            {it.summary && <p style={{ margin: '6px 0' }}>{it.summary}</p>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {(it.tags||[]).map((t) => (
                <span key={t} onClick={()=>setActiveTag(t)} style={{ cursor: 'pointer', background: '#e2e8f0', color: '#0f172a', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>#{t}</span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
