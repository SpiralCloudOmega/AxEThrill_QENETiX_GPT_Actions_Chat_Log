#!/usr/bin/env node
// File-based AI inbox/outbox:
// Drop a .txt/.md file into logs/inbox; this script reads it as a question,
// calls the AI CLI to answer (with optional provider), and writes an .answer.md.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const siteDir = process.cwd();
const repoRoot = path.join(siteDir, '..');
const inboxDir = path.join(repoRoot, 'logs', 'inbox');

function ensure() { fs.mkdirSync(inboxDir, { recursive: true }); }

function listQuestions() {
  ensure();
  const files = fs.readdirSync(inboxDir).filter(f => /\.(txt|md)$/i.test(f));
  return files.map(f => path.join(inboxDir, f)).filter(f => !fs.existsSync(f + '.answer.md'));
}

function readQuestion(file) {
  const s = fs.readFileSync(file, 'utf8').trim();
  return s.split('\n\n')[0] || s.split('\n')[0] || s;
}

function writeAnswer(file, question, answer) {
  const out = `${path.basename(file)}\n\nQ: ${question}\n\nA:\n${answer}\n`;
  fs.writeFileSync(file + '.answer.md', out);
}

function handleOne(file, provider, model) {
  const q = readQuestion(file);
  const cmd = `node scripts/ai-cli.mjs ask --provider=${provider} ${model ? `--model=${model} ` : ''}"${q.replace(/"/g, '\\"')}"`;
  const ans = execSync(cmd, { cwd: siteDir, encoding: 'utf8' });
  writeAnswer(file, q, ans.trim());
  return { file, q };
}

async function main() {
  const once = process.argv.includes('--once');
  const provider = (process.env.AI_PROVIDER || 'rag');
  const modelArg = process.env.AI_MODEL || '';
  if (once) {
    const files = listQuestions();
    for (const f of files) {
      try { const r = handleOne(f, provider, modelArg); console.error('Answered:', path.relative(repoRoot, r.file)); } catch (e) { console.error('Error answering', f, e?.message || e); }
    }
    return;
  }
  console.error('Watching inbox at', path.relative(repoRoot, inboxDir), 'provider=', provider);
  setInterval(() => {
    const files = listQuestions();
    for (const f of files) {
      try { const r = handleOne(f, provider, modelArg); console.error('Answered:', path.relative(repoRoot, r.file)); } catch (e) { console.error('Error answering', f, e?.message || e); }
    }
  }, 3000);
}

main();
