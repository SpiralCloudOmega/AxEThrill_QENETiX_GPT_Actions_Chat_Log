"use client";

import { useEffect } from 'react';

export default function ViewTracker({ href, title, relPath }: { href: string; title: string; relPath: string }) {
  useEffect(() => {
    try {
      const key = 'recentlyViewedLogs';
      const raw = localStorage.getItem(key) || '[]';
      let arr: any[] = [];
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) arr = parsed; } catch {}
      const viewedAt = new Date().toISOString();
      const item = { href, title, relPath, viewedAt };
      const next = [item, ...arr.filter((x) => x && x.href !== href)].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  }, [href, title, relPath]);
  return null;
}
