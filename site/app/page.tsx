import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

type Entry = {
  href: string;
  title: string;
  date: string;
  relPath: string;
};

function parseHeader(md: string) {
  const first = md.split('\n').slice(0, 20).join('\n');
  const idMatch = first.match(/Conversation ID:\s*(.+)/i);
  const receivedMatch = first.match(/Received At:\s*([^\n]+)/i);
  
  // Look for the first heading
  const lines = md.split('\n');
  const titleMatch = lines.find(line => line.trim().startsWith('#'));
  const title = titleMatch ? titleMatch.replace(/^#+\s*/, '').trim() : 'Chat Transcript';

  return {
    id: idMatch?.[1]?.trim() ?? '',
    receivedAt: receivedMatch?.[1]?.trim() ?? '',
    title: title
  };
}

function getLogsDir() {
  return path.join(process.cwd(), '..', 'logs');
}

function toSlug(rel: string) {
  const noExt = rel.replace(/\.md$/i, '');
  const parts = noExt.split(path.sep).slice(1);
  return parts;
}

export default async function Page() {
  const logsDir = getLogsDir();
  const exists = fs.existsSync(logsDir);
  let entries: Entry[] = [];

  if (exists) {
    const files = await fg('logs/**/*.md', { cwd: path.join(process.cwd(), '..') });
    entries = files.map((relPath) => {
      const full = path.join(process.cwd(), '..', relPath);
      const md = fs.readFileSync(full, 'utf8');
      const meta = parseHeader(md);

      const slugParts = toSlug(relPath);
      const href = '/logs/' + slugParts.join('/');

      const [yyyy, mm, dd] = slugParts;
      const date = yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : meta.receivedAt;

      return {
        href,
        title: meta.title || `Transcript ${relPath}`,
        date,
        relPath
      };
    });

    entries.sort((a, b) => b.relPath.localeCompare(a.relPath));
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>All conversations</h2>
      {!exists && (
        <p>
          No logs directory found. Once your webhook or GPT Action writes to <code>logs/</code>, rebuild the site.
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {entries.map((e) => (
          <li key={e.href} style={{ padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
            <a href={e.href} style={{ textDecoration: 'none', color: '#0ea5e9' }}>
              {e.title}
            </a>
            <div style={{ fontSize: 12, color: '#64748b' }}>{e.date} — {e.relPath}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}