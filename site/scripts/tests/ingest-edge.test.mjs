#!/usr/bin/env node
/**
 * Edge-case tests for ingest.mjs
 * - missing title
 * - tags injection
 * - duplicate handling
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'child_process';

const root = path.resolve(__dirname, '../../..');
const script = path.join(root, 'site/scripts/ingest.mjs');
const testDir = path.join(root, 'logs/inbox/ingest-test');
const incomingDir = path.join(root, 'logs/incoming');
fs.mkdirSync(testDir, { recursive: true });
fs.mkdirSync(incomingDir, { recursive: true });

function cleanup() {
  fs.rmSync(testDir, { recursive: true, force: true });
  for (const f of fs.readdirSync(incomingDir)) {
    if (f.startsWith('test-')) fs.unlinkSync(path.join(incomingDir, f));
  }
}

function write(file, content) {
  fs.writeFileSync(path.join(testDir, file), content, 'utf8');
}

function readIncoming(name) {
  return fs.readFileSync(path.join(incomingDir, name), 'utf8');
}

function runIngest(args) {
  execSync(`node ${script} dir ${testDir} ${args}`, { stdio: 'inherit' });
}

try {
  cleanup();
  // Test 1: Missing title
  write('test-missing-title.md', 'This is a log with no heading.');
  runIngest('');
  const out1 = readIncoming('test-missing-title.md');
  if (!/^# test-missing-title/m.test(out1)) throw new Error('Missing title not injected');

  // Test 2: Tags injection
  write('test-tags.md', '# Title\nContent');
  runIngest('--tags edge,unit');
  const out2 = readIncoming('test-tags.md');
  if (!/^---\ntags: edge, unit\n---/m.test(out2)) throw new Error('Tags frontmatter not injected');

  // Test 3: Duplicate handling (should overwrite)
  write('test-dup.md', '# First\nA');
  runIngest('');
  write('test-dup.md', '# Second\nB');
  runIngest('');
  const out3 = readIncoming('test-dup.md');
  if (!/^# Second/m.test(out3)) throw new Error('Duplicate file not overwritten');

  console.log('All ingest edge-case tests passed.');
  cleanup();
} catch (e) {
  cleanup();
  console.error('Ingest edge-case test failed:', e.message);
  process.exit(1);
}
