"use client";

import { useEffect } from 'react';

export default function LogHotkeys({ prevHref, nextHref }: { prevHref?: string; nextHref?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && prevHref) {
        e.preventDefault();
        window.location.assign(prevHref);
      } else if (e.key === 'ArrowRight' && nextHref) {
        e.preventDefault();
        window.location.assign(nextHref);
      } else if (e.key.toLowerCase() === 't') {
        // 't' for Top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevHref, nextHref]);

  return null;
}
