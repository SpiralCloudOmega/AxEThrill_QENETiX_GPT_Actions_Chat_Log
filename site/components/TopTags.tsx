"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from './Toast';

export default function TopTags({ tags }: { tags: { tag: string; count: number }[] }){
  const [pinned, setPinned] = useState<string[]>([]);
  const { toast } = useToast();
  useEffect(() => {
    try { setPinned(JSON.parse(localStorage.getItem('pinnedTags') || '[]')); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('pinnedTags', JSON.stringify(pinned)); } catch {}
  }, [pinned]);

  const pinSet = useMemo(() => new Set(pinned), [pinned]);
  const pinnedList = tags.filter(t => pinSet.has(t.tag));
  const unpinnedTop = tags.filter(t => !pinSet.has(t.tag));

  return (
    <div>
      {pinnedList.length > 0 && (
        <div style={{ margin: '4px 0 12px' }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Pinned tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pinnedList.map(({ tag, count }) => (
              <TagPill key={'p:'+tag} tag={tag} count={count} pinned onToggle={() => { setPinned(p => p.filter(x => x !== tag)); try { toast(`Unpinned #${tag}`, { type: 'info' }); } catch {} }} />
            ))}
          </div>
        </div>
      )}
      <div style={{ margin: '4px 0 12px' }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Top tags</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {unpinnedTop.map(({ tag, count }) => (
            <TagPill key={'t:'+tag} tag={tag} count={count} pinned={false} onToggle={() => { setPinned(p => [...new Set([tag, ...p])].slice(0, 24)); try { toast(`Pinned #${tag}`, { type: 'success' }); } catch {} }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TagPill({ tag, count, pinned, onToggle }: { tag: string; count: number; pinned: boolean; onToggle: () => void }){
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', borderRadius: 999, padding: '4px 8px', background: 'white' }}>
      <Link href={`/tags/${encodeURIComponent(tag)}`} style={{ textDecoration: 'none', fontSize: 13 }}>#{tag}</Link>
      <span style={{ color: '#64748b', fontSize: 12 }}>{count}</span>
      <button onClick={onToggle} title={pinned ? 'Unpin' : 'Pin'} style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: 6, background: pinned ? '#fde68a' : 'white', cursor: 'pointer', fontSize: 12 }}>
        {pinned ? 'Unpin' : 'Pin'}
      </button>
    </span>
  );
}
