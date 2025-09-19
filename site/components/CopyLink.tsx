"use client";

import { useState } from 'react';
import { useToast } from './Toast';

export default function CopyLink({ href, label = 'Copy link', absolute = true }: { href: string; label?: string; absolute?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  async function copy() {
    try {
      const url = absolute ? (location.origin + href) : href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
      try { toast('Link copied', { type: 'success' }); } catch {}
    } catch {
      setCopied(false);
      try { toast('Copy failed', { type: 'error' }); } catch {}
    }
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button onClick={copy} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: 12 }}>
        {label}
      </button>
      {copied && <span style={{ fontSize: 12, color: '#16a34a' }}>Copied!</span>}
    </span>
  );
}
