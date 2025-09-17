import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { marked } from 'marked';

function logsRoot() {
  return path.join(process.cwd(), '..', 'logs');
}

function fileFromSlug(slug: string[]) {
  return path.join(logsRoot(), ...slug) + '.md';
}

export async function generateStaticParams() {
  const logsDir = logsRoot();
  
  if (!fs.existsSync(logsDir)) {
    // Return a minimal placeholder to satisfy Next.js build requirements
    return [{ slug: ['404'] }];
  }
  
  try {
    const files = await fg('**/*.md', { cwd: logsDir });
    
    if (files.length === 0) {
      return [{ slug: ['404'] }];
    }
    
    const params = files.map((rel) => {
      const parts = rel.replace(/\.md$/i, '').split(path.sep);
      return { slug: parts };
    });
    
    return params;
  } catch (error) {
    return [{ slug: ['404'] }];
  }
}

export default async function LogPage({ params }: { params: { slug: string[] } }) {
  const full = fileFromSlug(params.slug);
  if (!fs.existsSync(full)) {
    return <div>Not found</div>;
  }
  const md = fs.readFileSync(full, 'utf8');
  const html = marked.parse(md) as string;

  return (
    <article>
      <a href="/">&larr; Back</a>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <style>{`
        article :is(h1,h2,h3){ margin-top: 1.5rem; }
        article p, article li { line-height: 1.6; }
        code, pre { background: #f1f5f9; padding: 2px 4px; border-radius: 4px; }
        pre { padding: 12px; overflow: auto; }
        blockquote { color: #475569; border-left: 4px solid #e2e8f0; margin: 1rem 0; padding: 0.5rem 1rem; }
        a { color: #0ea5e9; }
      `}</style>
    </article>
  );
}