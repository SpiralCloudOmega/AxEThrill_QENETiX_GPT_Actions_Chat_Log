"use client";

import { useMemo, useState } from 'react';

function sanitize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

export default function NewChatPage() {
  const [title, setTitle] = useState('Untitled Chat');
  const [id, setId] = useState('');
  const [received, setReceived] = useState(() => new Date().toISOString());
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState('# Notes\n\nStart writing your transcript here...');
  const [tags, setTags] = useState('');

  const slug = useMemo(() => sanitize(title || 'chat'), [title]);
  const [yyyy, mm, dd] = date.split('-');
  const relPath = `logs/${yyyy}/${mm}/${dd}/${slug}.md`;
  const md = `# ${title}\n\nConversation ID: ${id}\nReceived At: ${received}\n${tags ? `Tags: ${tags}\n` : ''}\n${content}\n`;

  function download(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  }

  return (
    <div>
      <h2>Create a new chat (local)</h2>
      <p style={{ color: '#64748b' }}>This page helps you generate a Markdown file you can download and commit to the repository.</p>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Conversation ID (optional)</span>
          <input value={id} onChange={(e) => setId(e.target.value)} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Received At (ISO)</span>
          <input value={received} onChange={(e) => setReceived(e.target.value)} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Date (YYYY-MM-DD)</span>
          <input value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} />
        </label>
        <label style={{ gridColumn: '1 / -1', display: 'grid', gap: 6 }}>
          <span>Tags (comma separated)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} />
        </label>
        <label style={{ gridColumn: '1 / -1', display: 'grid', gap: 6 }}>
          <span>Content</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, fontFamily: 'monospace' }} />
        </label>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => download(md, `${slug}.md`)} style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}>Download .md</button>
        <button onClick={() => copy(md)} style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'white', cursor: 'pointer' }}>Copy Markdown</button>
        <span style={{ color: '#64748b' }}>Suggested path: <code>{relPath}</code></span>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary>CLI alternative</summary>
        <p style={{ color: '#64748b' }}>You can also save via CLI in the dev container: <code>npm run save:chat -- --title "{title}" --content path-or-"-" --date {date} --id {id || 'ID'} --received {received}</code></p>
      </details>
    </div>
  );
}
