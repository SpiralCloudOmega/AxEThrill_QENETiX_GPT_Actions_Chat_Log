import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');
const publicDir = path.join(siteDir, 'public');
const allowedRoots = [ path.join(repoRoot, 'logs'), publicDir ];

function isAllowed(fp){ const r = path.resolve(fp); return allowedRoots.some(root => r === root || r.startsWith(root+path.sep)); }
function clampBytes(str, maxBytes){
  if (!maxBytes) return str;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const bytes = enc.encode(String(str));
  if (bytes.length <= maxBytes) return String(str);
  return dec.decode(bytes.slice(0, maxBytes));
}
function stripScriptsStyles(html){
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
}
function decodeEntities(s){
  return String(s)
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function htmlToMarkdown(html){
  let h = stripScriptsStyles(html);
  h = h.replace(/\r/g,'');
  const title = decodeEntities((h.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'').trim());
  // Basic anchor conversion
  h = h.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, text) => `[${decodeEntities(text).replace(/\s+/g,' ').trim()}](${href})`);
  // Headings
  h = h.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (m,t)=>`\n# ${decodeEntities(t).trim()}\n`)
       .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (m,t)=>`\n## ${decodeEntities(t).trim()}\n`)
       .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (m,t)=>`\n### ${decodeEntities(t).trim()}\n`)
       .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (m,t)=>`\n#### ${decodeEntities(t).trim()}\n`)
  // Paragraphs and list items
  h = h.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (m,t)=>`\n${decodeEntities(t).replace(/<br\s*\/>/gi,'\n').replace(/<[^>]+>/g,'').trim()}\n`)
       .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m,t)=>`\n- ${decodeEntities(t).replace(/<[^>]+>/g,'').trim()}`)
  // Code blocks
  h = h.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (m,t)=>`\n\n\
\`\`\`\n${decodeEntities(t)}\n\`\`\`\n\n`)
       .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (m,t)=>`\`${decodeEntities(t)}\``);
  // Remove remaining tags
  h = h.replace(/<[^>]+>/g,'');
  // Collapse whitespace
  h = h.replace(/\n{3,}/g,'\n\n').trim();
  return { title, markdown: h };
}

function summarize(text, max=280){
  const t = String(text).replace(/\s+/g,' ').trim();
  return t.length>max ? t.slice(0,max-1)+"…" : t;
}

export async function scrapeUrl({ url, format='markdown', timeoutMs=12000, maxBytes=1_500_000, userAgent='Mozilla/5.0 (AI-CLI Scraper)' }){
  if (!/^https?:\/\/./i.test(String(url||''))) throw new Error('Only http(s) URLs allowed');
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  // Basic SSRF guard
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    throw new Error('Blocked private/localhost host');
  }
  const ac = new AbortController();
  const to = setTimeout(()=>ac.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { headers: { 'user-agent': userAgent, 'accept': '*/*' }, signal: ac.signal });
  } finally {
    clearTimeout(to);
  }
  const ct = String(res.headers.get('content-type')||'').toLowerCase();
  const cl = Number(res.headers.get('content-length')||0);
  if (cl && maxBytes && cl > maxBytes) throw new Error(`Content-Length ${cl} exceeds limit ${maxBytes}`);
  const buf = await res.arrayBuffer();
  const raw = clampBytes(Buffer.from(buf).toString('utf8'), maxBytes);
  let out = { url, contentType: ct, title: '', text: '', markdown: '', links: [] };
  if (ct.includes('html')){
    const { title, markdown } = htmlToMarkdown(raw);
    // Collect links
    const linkRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
    const links = [];
    let m; const html = stripScriptsStyles(raw);
    while((m = linkRe.exec(html))) { const href = m[1]; if (href && !href.startsWith('javascript:')) links.push(href); }
    out = { ...out, title, markdown, text: markdown, links };
  } else if (ct.includes('json')) {
    out = { ...out, title: '', markdown: '```json\n'+raw+'\n```', text: raw };
  } else if (ct.includes('text')) {
    out = { ...out, title: '', markdown: raw, text: raw };
  } else {
    out = { ...out, title: '', markdown: '', text: '', note: 'Unsupported content-type; fetched raw bytes truncated', bytes: Buffer.byteLength(raw,'utf8') };
  }
  if (format === 'text') return { ...out, content: out.text };
  if (format === 'json') return out;
  return { ...out, content: out.markdown };
}

export function scrapeFile({ file, format='markdown', maxBytes=1_500_000 }){
  const fp = path.isAbsolute(file) ? file : path.join(repoRoot, file);
  if (!isAllowed(fp)) throw new Error('Path not allowed');
  if (!fs.existsSync(fp)) throw new Error('No such file');
  const raw = clampBytes(fs.readFileSync(fp, 'utf8'), maxBytes);
  const ext = path.extname(fp).toLowerCase();
  if (ext === '.html' || ext === '.htm'){
    const { title, markdown } = htmlToMarkdown(raw);
    return { file: path.relative(repoRoot, fp), contentType: 'text/html', title, markdown, text: markdown, links: [], content: format==='text'?markdown:markdown };
  }
  if (ext === '.md' || ext === '.markdown'){
    return { file: path.relative(repoRoot, fp), contentType: 'text/markdown', title: path.basename(fp), markdown: raw, text: raw, links: [], content: format==='text'?raw:raw };
  }
  if (ext === '.json'){
    return { file: path.relative(repoRoot, fp), contentType: 'application/json', title: path.basename(fp), markdown: '```json\n'+raw+'\n```', text: raw, links: [], content: format==='text'?raw:('```json\n'+raw+'\n```') };
  }
  // fallback plain text
  return { file: path.relative(repoRoot, fp), contentType: 'text/plain', title: path.basename(fp), markdown: raw, text: raw, links: [], content: format==='text'?raw:raw };
}

export function makeMemoryFromScrape({ out, kind='url' }){
  const title = out.title || (kind==='url' ? out.url : out.file);
  const content = out.markdown || out.text || out.content || '';
  const summary = summarize(content, 400);
  const source = kind==='url' ? out.url : out.file;
  return { title, content, summary, source };
}

export default { scrapeUrl, scrapeFile, makeMemoryFromScrape };
