"use client";

import { useEffect } from 'react';

export default function HomeHotkeys({ hrefs }: { hrefs: string[] }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e as any).isComposing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === 't') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (k === 's' || k === '/') {
        e.preventDefault();
        window.location.assign('/search');
      } else if (k === 'm') {
        e.preventDefault();
        window.location.assign('/memory');
      } else if (k === 'a') {
        e.preventDefault();
        window.location.assign('/ai');
      } else if (k === 'g') {
        e.preventDefault();
        window.location.assign('/agents');
      } else if (k === 'r') {
        if (hrefs && hrefs.length > 0) {
          e.preventDefault();
          const i = Math.floor(Math.random() * hrefs.length);
          window.location.assign(hrefs[i]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hrefs]);

  return null;
}
