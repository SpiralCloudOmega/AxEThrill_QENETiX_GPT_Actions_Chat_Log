import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import LogToolbar from '../../../components/LogToolbar';
import CodeCopyEnhancer from '../../../components/CodeCopyEnhancer';
import LogHotkeys from '../../../components/LogHotkeys';
import nextDynamic from 'next/dynamic';
const ViewTracker = nextDynamic(() => import('../../../components/ViewTracker'), { ssr: false });
const RelatedLogs = nextDynamic(() => import('../../../components/RelatedLogs'), { ssr: false });
const NextOptions = nextDynamic(() => import('../../../components/NextOptions'), { ssr: false });
import type { Metadata } from 'next';
import { normalizeTags } from '../../../scripts/lib/tags.mjs';

export const dynamic = 'error'; // enforce static generation
export const dynamicParams = false; // only generate paths from generateStaticParams

function logsRoot() {
  return path.join(process.cwd(), '..', 'logs');
}

function fileFromSlug(slug: string[]) {
  return path.join(logsRoot(), ...slug) + '.md';
}

export async function generateStaticParams() {
  const logsDir = logsRoot();
  if (!fs.existsSync(logsDir)) {
    return [];
  }
  
  const files = await fg('**/*.md', { cwd: logsDir });
  return files.map((rel) => {
    const parts = rel.replace(/\.md$/i, '').split(path.sep);
    return { slug: parts };
  });
}

export default async function LogPage({ params }: { params: { slug: string[] } }) {
  const full = fileFromSlug(params.slug);
  if (!fs.existsSync(full)) {
    notFound();
  }
  const md = fs.readFileSync(full, 'utf8');
  marked.use(markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }));
  const html = marked.parse(md) as string;
  const titleMatch = md.match(/^#\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() || 'Chat Transcript';
  // Extract optional system metadata commonly found in build logs
  const first = md.split('\n').slice(0, 60).join('\n');
  const meta = {
    gpu: first.match(/^(?:GPU|Graphics)\s*:\s*([^\n]+)/im)?.[1]?.trim(),
    driver: first.match(/^(?:Driver|NVIDIA Driver)\s*:\s*([^\n]+)/im)?.[1]?.trim(),
    ue: first.match(/^(?:UE|Unreal)\s*:\s*([^\n]+)/im)?.[1]?.trim(),
    rust: first.match(/^Rust\s*:\s*([^\n]+)/im)?.[1]?.trim(),
    kernel: first.match(/^(?:Kernel|Linux)\s*:\s*([^\n]+)/im)?.[1]?.trim(),
    distro: first.match(/^Distro\s*:\s*([^\n]+)/im)?.[1]?.trim(),
    cpu: first.match(/^CPU\s*:\s*([^\n]+)/im)?.[1]?.trim(),
    memory: first.match(/^Memory\s*:\s*([^\n]+)/im)?.[1]?.trim(),
    audio: first.match(/^Audio\s*:\s*([^\n]+)/im)?.[1]?.trim(),
    display: first.match(/^Display\s*:\s*([^\n]+)/im)?.[1]?.trim(),
    openrgb: first.match(/^OpenRGB\s*:\s*([^\n]+)/im)?.[1]?.trim(),
  };
  const tagLine = first.match(/Tags:\s*([^\n]+)/i)?.[1] || '';
  const tags = normalizeTags(tagLine ? tagLine.split(',').map((t) => t.trim()).filter(Boolean) : []);
  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const githubRel = 'logs/' + params.slug.join('/') + '.md';
  const githubUrl = owner && repo ? `https://github.com/${owner}/${repo}/blob/main/${githubRel}` : undefined;
  const rawUrl = owner && repo ? `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/${githubRel}` : undefined;
  // Build prev/next based on alphabetical order of rel paths
  const all = await fg('**/*.md', { cwd: logsRoot() });
  const rel = params.slug.join('/') + '.md';
  const idx = all.findIndex((x) => x === rel);
  const prev = idx > 0 ? all[idx - 1] : undefined;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : undefined;
  const toHref = (r?: string) => (r ? '/logs/' + r.replace(/\.md$/i, '').split(path.sep).join('/') : undefined);
  const prevHref = toHref(prev);
  const nextHref = toHref(next);

  return (
    <article>
      <ViewTracker href={toHref(rel)!} title={title} relPath={rel} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/">&larr; Back</Link>
        <a href="/help" style={{ fontSize: 12, textDecoration: 'none' }} title="Open Help">Help</a>
      </div>
  <NextOptions contextTags={tags} />
      <LogToolbar md={md} prevHref={prevHref} nextHref={nextHref} githubUrl={githubUrl} rawUrl={rawUrl} />
  <CodeCopyEnhancer />
      <LogHotkeys prevHref={prevHref} nextHref={nextHref} />
      {(meta.gpu || meta.driver || meta.ue || meta.rust || meta.kernel || meta.distro || meta.cpu || meta.memory || meta.audio || meta.display || meta.openrgb) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 16px' }}>
          {meta.gpu && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>GPU: {meta.gpu}</span>}
          {meta.driver && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>Driver: {meta.driver}</span>}
          {meta.ue && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>UE: {meta.ue}</span>}
          {meta.rust && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>Rust: {meta.rust}</span>}
          {meta.kernel && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>Kernel: {meta.kernel}</span>}
          {meta.distro && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>Distro: {meta.distro}</span>}
          {meta.cpu && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>CPU: {meta.cpu}</span>}
          {meta.memory && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>Memory: {meta.memory}</span>}
          {meta.audio && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>Audio: {meta.audio}</span>}
          {meta.display && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>Display: {meta.display}</span>}
          {meta.openrgb && <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>OpenRGB: {meta.openrgb}</span>}
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
  <RelatedLogs currentRel={rel} />
      <style>{`
        article :is(h1,h2,h3){ margin-top: 1.5rem; }
        article p, article li { line-height: 1.6; }
        blockquote { color: #475569; border-left: 4px solid #e2e8f0; margin: 1rem 0; padding: 0.5rem 1rem; }
        a { color: #0ea5e9; }
      `}</style>
    </article>
  );
}

export async function generateMetadata({ params }: { params: { slug: string[] } }): Promise<Metadata> {
  const full = fileFromSlug(params.slug);
  if (!fs.existsSync(full)) return {};
  const md = fs.readFileSync(full, 'utf8');
  const titleMatch = md.match(/^#\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() || 'Chat Transcript';
  return { title };
}