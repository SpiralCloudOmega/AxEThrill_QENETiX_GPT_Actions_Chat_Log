"use client";

import Link from 'next/link';

export default function LogToolbar({
  md,
  prevHref,
  nextHref,
  githubUrl,
  rawUrl,
}: {
  md: string;
  prevHref?: string;
  nextHref?: string;
  githubUrl?: string;
  rawUrl?: string;
}) {
  function download(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard');
    } catch {
      alert('Copy failed');
    }
  }

  async function share() {
    const url = window.location.href;
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({ title: document.title, url });
      } catch {
        // ignore
      }
    } else {
      copyText(url);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '12px 0' }}>
      {prevHref && (
        <Link href={prevHref} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6 }}>← Newer</Link>
      )}
      {nextHref && (
        <Link href={nextHref} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6 }}>Older →</Link>
      )}
      <button onClick={() => copyText(md)} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}>Copy Markdown</button>
      <button onClick={() => download(md, 'chat.md')} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}>Download .md</button>
      <button onClick={share} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}>Share</button>
      <button onClick={() => window.print()} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}>Print</button>
      {githubUrl && (
        <a href={githubUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>View on GitHub</a>
      )}
      {rawUrl && (
        <a href={rawUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>Raw</a>
      )}
    </div>
  );
}
