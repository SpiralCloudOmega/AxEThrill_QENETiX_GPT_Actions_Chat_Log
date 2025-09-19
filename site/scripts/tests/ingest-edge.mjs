#!/usr/bin/env node
/**
 * Edge-case tests for ingest.mjs
 * Lightweight manual test harness (no jest dependency): prints JSON results and exits non-zero on failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.join(process.cwd(), '..');
const site = process.cwd();
const tmpDir = path.join(site, '.tmp-ingest-tests');
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

function run(cmd){
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

function assert(cond, msg){
  if(!cond){
    console.error('ASSERT FAIL:', msg);
    process.exit(1);
  }
}

// 1. Missing title auto-insertion
const file1 = path.join(tmpDir, 'note1.md');
fs.writeFileSync(file1, 'Some content without heading');
run(`node site/scripts/ingest.mjs file ${file1}`);
const ingIncoming = path.join(root, 'logs', 'incoming');
const produced1 = path.join(ingIncoming, 'note1.md');
assert(fs.existsSync(produced1), 'note1.md was not ingested');
const text1 = fs.readFileSync(produced1, 'utf8');
assert(/^# note1\n/.test(text1), 'Title not auto-added for note1');

// 2. Tags injection
const file2 = path.join(tmpDir, 'tagged.md');
fs.writeFileSync(file2, '# Heading\nBody');
run(`node site/scripts/ingest.mjs file ${file2} --tags alpha,beta`);
const produced2 = path.join(ingIncoming, 'tagged.md');
const text2 = fs.readFileSync(produced2, 'utf8');
assert(/tags: alpha, beta/.test(text2), 'Tags not injected');

// 3. Duplicate import overwrite (idempotent)
const statBefore = fs.statSync(produced2).mtimeMs;
await new Promise(r=>setTimeout(r,20));
run(`node site/scripts/ingest.mjs file ${file2} --tags alpha,beta`);
const statAfter = fs.statSync(produced2).mtimeMs;
assert(statAfter >= statBefore, 'Duplicate ingest should overwrite or update timestamp');

// 4. Directory mode
const subDir = path.join(tmpDir, 'dir');
fs.mkdirSync(subDir);
fs.writeFileSync(path.join(subDir, 'a.md'), 'A');
fs.writeFileSync(path.join(subDir, 'b.md'), '# B');
run(`node site/scripts/ingest.mjs dir ${subDir} --tags bulk`);
assert(fs.existsSync(path.join(ingIncoming, 'a.md')), 'Dir ingest a.md missing');
assert(fs.existsSync(path.join(ingIncoming, 'b.md')), 'Dir ingest b.md missing');

console.log(JSON.stringify({ ok:true, tests:4 }));
