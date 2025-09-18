import type { MetadataRoute } from 'next';
import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

function baseUrl() {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
  const isPages = process.env.GITHUB_ACTIONS === 'true';
  return isPages && repo && owner ? `https://${owner}.github.io/${repo}` : 'http://localhost:3000';
}

function logsRoot() {
  return path.join(process.cwd(), '..', 'logs');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = baseUrl();
  const items: MetadataRoute.Sitemap = [
    { url: `${url}/`, changeFrequency: 'daily', priority: 0.8 },
  ];

  const root = logsRoot();
  if (!fs.existsSync(root)) return items;

  const files = await fg('**/*.md', { cwd: root });
  for (const rel of files) {
    const parts = rel.replace(/\.md$/i, '').split(path.sep);
    const href = `${url}/logs/${parts.join('/')}/`;
    items.push({ url: href, changeFrequency: 'weekly', priority: 0.6 });
  }

  return items;
}
