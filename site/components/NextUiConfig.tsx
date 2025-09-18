"use client";

import { useEffect, useState } from 'react';

export type UiConfig = {
  related?: { tagWeight?: number; k?: number };
  nextOptions?: { max?: number; fallbackTop?: number };
  search?: { maxResults?: number; maxTagChips?: number };
};

const DEFAULTS: Required<UiConfig> = {
  related: { tagWeight: 0.15, k: 5 },
  nextOptions: { max: 8, fallbackTop: 6 },
  search: { maxResults: 50, maxTagChips: 12 }
};

export function useUiConfig(){
  const [cfg, setCfg] = useState<UiConfig>(DEFAULTS);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(withBase('/ui/config.json'), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (!alive) return;
          setCfg({
            related: { ...DEFAULTS.related, ...(data.related || {}) },
            nextOptions: { ...DEFAULTS.nextOptions, ...(data.nextOptions || {}) },
            search: { ...DEFAULTS.search, ...(data.search || {}) }
          });
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  return cfg as Required<UiConfig>;
}

// Compute the deployed base path (e.g., "/repo-name" on GitHub Pages) by inspecting Next.js chunk script URLs.
export function getBasePath(): string {
  try {
    // Try reading any script whose src includes /_next/ and peel the prefix
    const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
    for (const s of scripts) {
      const src = s.getAttribute('src') || '';
      const idx = src.indexOf('/_next/');
      if (idx >= 0) {
        const url = new URL(src, location.href);
        const p = url.pathname;
        const cut = p.indexOf('/_next/');
        if (cut >= 0) {
          const base = p.slice(0, cut);
          return base === '/' ? '' : base;
        }
      }
    }
  } catch {}
  return '';
}

export function withBase(p: string): string {
  const base = typeof window !== 'undefined' ? getBasePath() : '';
  if (!p) return base || '/';
  const rel = p.startsWith('/') ? p : '/' + p;
  return (base || '') + rel;
}
