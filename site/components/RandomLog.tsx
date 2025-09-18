"use client";

import { useCallback } from 'react';

export default function RandomLog({ paths }: { paths: string[] }) {
  const go = useCallback(() => {
    if (!paths || paths.length === 0) return;
    const i = Math.floor(Math.random() * paths.length);
    const href = '/logs/' + paths[i].replace(/\.md$/i, '');
    window.location.assign(href);
  }, [paths]);

  return (
    <button onClick={go} style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}>
      Random Log
    </button>
  );
}
