import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import Link from 'next/link';
import { notFound } from 'next/navigation';

function logsRoot() {
  return path.join(process.cwd(), '..', 'logs');
}

function parseTitle(md: string) {
  const m = md.match(/^#\s*(.+)$/m);
  return m?.[1]?.trim() || 'Chat Transcript';
}

export async function generateStaticParams() {
  const root = logsRoot();
  if (!fs.existsSync(root)) return [];
  const files = await fg('**/*.md', { cwd: root });
  const set = new Set<string>();
  for (const rel of files) {
    const parts = rel.replace(/\.md$/i, '').split(path.sep);
    if (parts.length >= 3) set.add(parts.slice(0, 3).join('/'));
  }
  return Array.from(set).map((s) => {
    const [year, month, day] = s.split('/');
    return { year, month, day };
  });
}

export const dynamic = 'error';
export const dynamicParams = false;

export default async function DayIndex({ params }: { params: { year: string; month: string; day: string } }) {
  const { year, month, day } = params;
  const root = logsRoot();
  const dayDir = path.join(root, year, month, day);
  if (!fs.existsSync(dayDir)) notFound();
  const files = await fg('*.md', { cwd: dayDir });
  if (!files.length) notFound();

  const items = files.map((file) => {
    const full = path.join(dayDir, file);
    const md = fs.readFileSync(full, 'utf8');
    const title = parseTitle(md);
    const href = '/logs/' + [year, month, day, file.replace(/\.md$/i, '')].join('/');
    return { href, title, rel: `logs/${year}/${month}/${day}/${file}` };
  }).sort((a, b) => a.rel.localeCompare(b.rel));

  return (
    <div>
      <h2>{year}-{month}-{day}</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((e) => (
          <li key={e.rel} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
            <Link href={e.href} style={{ color: '#0ea5e9', textDecoration: 'none' }}>{e.title}</Link>
            <div style={{ fontSize: 12, color: '#64748b' }}>{e.rel}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
