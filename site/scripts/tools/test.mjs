#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');

async function main(){
  const { addMemory, buildMemoryIndex, listMemory, searchMemory } = await import('./memory.mjs');
  const { grepText } = await import('./grep.mjs');
  const { scrapeFile, scrapeUrl } = await import('./scraper.mjs');

  // 1) Memory: add -> build index -> list -> search
  const title = 'Test Capsule';
  const content = 'This is a test capsule with unique term foobarbazqux.';
  const tags = ['test', 'ci'];
  const { path: memPath } = addMemory({ title, content, tags, source: 'tools/test.mjs', summary: 'A test capsule' });
  assert.ok(fs.existsSync(memPath), 'memory file created');

  const buildRes = buildMemoryIndex();
  assert.ok(fs.existsSync(buildRes.path), 'memory-index.json created');

  const list = listMemory({ limit: 5 });
  assert.ok(Array.isArray(list) && list.length > 0, 'listMemory returns items');

  const search = searchMemory({ query: 'foobarbazqux', k: 3 });
  assert.ok(search.find(x => x.title.includes('Test Capsule')), 'searchMemory finds the new capsule');

  // 2) Grep: create a temp file under allowed roots and search
  const logsDir = path.join(repoRoot, 'logs', '2025', '09', '18');
  fs.mkdirSync(logsDir, { recursive: true });
  const tmpFile = path.join(logsDir, 'test-grep.txt');
  fs.writeFileSync(tmpFile, 'alpha\nbeta\nGAMMA\nUniqueNeedle123\n');
  const grepRes = grepText({ pattern: 'UniqueNeedle123', file: path.relative(repoRoot, tmpFile), flags: '' });
  assert.equal(grepRes.count, 1, 'grep finds exactly one match');

  // 3) Scraper: HTML -> Markdown conversion on a local file (headings + anchors)
  const html = `<!DOCTYPE html><html><head><title>Test Page</title></head><body><h1>Hello</h1><p>World <a href="https://example.com">link</a></p></body></html>`;
  const htmlFile = path.join(repoRoot, 'site', 'public', 'ui', 'demo', 'test.html');
  fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
  fs.writeFileSync(htmlFile, html);
  const sres = scrapeFile({ file: path.relative(repoRoot, htmlFile) });
  assert.ok(/# Hello/.test(sres.markdown), 'scraper converts H1');
  assert.ok(/\[link\]\(https:\/\/example.com\)/.test(sres.markdown), 'scraper converts anchor');

  // 3b) Scraper: inline code and preformatted blocks
  const htmlCode = `<!DOCTYPE html><html><head><title>Code Test</title></head><body>
    <p>Use <code>npm run dev</code> to start.</p>
    <pre><code>function hi(){\n  console.log("hi");\n}</code></pre>
  </body></html>`;
  const htmlCodeFile = path.join(repoRoot, 'site', 'public', 'ui', 'demo', 'code.html');
  fs.writeFileSync(htmlCodeFile, htmlCode);
  const sresCode = scrapeFile({ file: path.relative(repoRoot, htmlCodeFile) });
  assert.ok(/`npm run dev`/.test(sresCode.markdown), 'inline code wrapped in backticks');
  assert.ok(/```[\s\S]*console\.log\("hi"\);[\s\S]*```/.test(sresCode.markdown), 'pre>code becomes fenced block');

  // 4) Scraper URL SSRF guard (should throw for localhost and private ranges)
  let blocked = false;
  try { await scrapeUrl({ url: 'http://127.0.0.1:1234' }); } catch { blocked = true; }
  assert.ok(blocked, 'scraper blocks localhost URLs');
  for (const priv of ['http://192.168.1.5', 'http://10.0.0.7', 'http://172.16.0.9']){
    let b = false; try { await scrapeUrl({ url: priv }); } catch { b = true; }
    assert.ok(b, `scraper blocks private URL: ${priv}`);
  }

  // 5) ScrapeFile path guard: disallow repo files outside allowed roots
  let disallowed = false;
  try { scrapeFile({ file: 'README.md' }); } catch { disallowed = true; }
  assert.ok(disallowed, 'scrapeFile blocks non-allowed repo paths');

  console.log('OK: tools test passed', { memoryIndex: buildRes.path, grepFile: grepRes.file, scrapedFile: sres.file });
}

main().catch((e)=>{ console.error('Test failed:', e); process.exit(1); });
