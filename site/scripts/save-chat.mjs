#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function usage() {
  console.log(`Usage: npm run save:chat -- --title "Title" --content file.md|-
Options:
  --title      Title of the chat (used as H1)
  --id         Optional conversation ID
  --received   Optional Received At timestamp (ISO string)
  --slug       Optional filename slug (default: sanitized title)
  --date       Optional date YYYY-MM-DD (default: today)
  --tags       Optional comma-separated tags (e.g. ai, action, debug)
  --commit     If set, git add+commit the new file

If --content is '-', read from stdin; otherwise provide a path to a Markdown file.`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true };
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1]?.startsWith('--') || argv[i + 1] == null ? true : argv[++i];
      args[key] = val;
    }
  }
  return args;
}

function sanitize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

async function readContent(src) {
  if (src === '-' || !src) {
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => (data += c));
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', reject);
    });
  }
  return fs.readFileSync(path.resolve(src), 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) return usage();
  if (!args.title) return (console.error('Missing --title'), usage());

  const content = await readContent(args.content);
  const today = args.date || new Date().toISOString().slice(0, 10);
  const [yyyy, mm, dd] = today.split('-');
  const slug = args.slug || sanitize(args.title);

  const repoRoot = path.join(process.cwd(), '..');
  const dir = path.join(repoRoot, 'logs', yyyy, mm, dd);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug}.md`);

  const header = `# ${args.title}\n\nConversation ID: ${args.id || ''}\nReceived At: ${args.received || new Date().toISOString()}\n${args.tags ? `Tags: ${args.tags}\n` : ''}\n`;
  const body = header + content.trim() + '\n';
  fs.writeFileSync(file, body);
  console.log('Saved', path.relative(repoRoot, file));

  if (args.commit) {
    execSync('git add logs', { stdio: 'inherit', cwd: repoRoot });
    execSync(`git commit -m "chore(logs): add ${yyyy}/${mm}/${dd}/${slug}.md"`, { stdio: 'inherit', cwd: repoRoot });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
