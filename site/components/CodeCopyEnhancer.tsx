"use client";

import { useEffect } from 'react';

export default function CodeCopyEnhancer() {
  useEffect(() => {
    // shared live region
    let live = document.getElementById('copy-live-region');
    if (!live) {
      live = document.createElement('div');
      live.id = 'copy-live-region';
      live.setAttribute('aria-live', 'polite');
      live.style.position = 'absolute';
      live.style.width = '1px';
      live.style.height = '1px';
      live.style.overflow = 'hidden';
      live.style.clip = 'rect(1px,1px,1px,1px)';
      document.body.appendChild(live);
    }

    function announce(msg: string){
      if (!live) return;
      live.textContent = msg;
    }

    function ensure(pre: HTMLPreElement) {
      if (pre.querySelector('.copy-btn')) return;
      pre.style.position = pre.style.position || 'relative';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      btn.textContent = 'Copy';
      btn.className = 'copy-btn';
      Object.assign(btn.style, {
        position: 'absolute', top: '8px', right: '8px', padding: '4px 8px',
        fontSize: '12px', border: '1px solid var(--border-copy-btn, #cbd5e1)', borderRadius: '6px',
        background: 'var(--bg-copy-btn, #ffffff)', cursor: 'pointer',
        color: 'var(--fg-copy-btn, #0f172a)', opacity: '0.85'
      } as CSSStyleDeclaration);
      btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
      btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.85'; });
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code');
        const text = code?.textContent || '';
        try {
          await navigator.clipboard.writeText(text);
          const prev = btn.textContent;
            btn.textContent = 'Copied!';
            announce('Code copied to clipboard');
            setTimeout(() => { btn.textContent = prev || 'Copy'; }, 1400);
        } catch (e) {
          const prev = btn.textContent;
          btn.textContent = 'Failed';
          announce('Copy failed');
          setTimeout(() => { btn.textContent = prev || 'Copy'; }, 1400);
        }
      });
      pre.appendChild(btn);
    }
    const pres = Array.from(document.querySelectorAll('pre')) as HTMLPreElement[];
    pres.forEach(ensure);
    // Observe future inserted pre blocks (if any dynamic content loads)
    const observer = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement) {
            if (n.tagName === 'PRE') ensure(n as HTMLPreElement);
            n.querySelectorAll?.('pre').forEach((p) => ensure(p as HTMLPreElement));
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
