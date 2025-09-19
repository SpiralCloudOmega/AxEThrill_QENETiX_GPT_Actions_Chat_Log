#!/usr/bin/env node
// Simple ledger behavior test (no framework) exits non-zero on failure.
// Simulates incremental token additions and cap enforcement logic similar to workflow.
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(process.cwd(), '..');
const stateDir = path.join(repoRoot, 'logs', 'memory', 'agent-state');
const ledgerFile = path.join(stateDir, 'token-ledger.test.json');

function reset() { fs.mkdirSync(stateDir, { recursive: true }); if (fs.existsSync(ledgerFile)) fs.unlinkSync(ledgerFile); }
function load() { try { return JSON.parse(fs.readFileSync(ledgerFile, 'utf8')); } catch { return { days:{}, updatedAt:0 }; } }
function update(add, limit=1000, dateStr) {
  const d = dateStr || new Date().toISOString().slice(0,10);
  const data = load();
  const used = data.days[d] || 0;
  if (used + add > limit) return { skipped: true, used, limit };
  data.days[d] = used + add;
  data.updatedAt = Math.floor(Date.now()/1000);
  fs.writeFileSync(ledgerFile, JSON.stringify(data));
  return { skipped: false, used: data.days[d], limit };
}

function assert(cond, msg) { if (!cond) { console.error('FAIL', msg); process.exit(1); } }

reset();
let r = update(200, 1000, '2030-01-01');
assert(!r.skipped && r.used === 200, 'First add failed');
r = update(300, 1000, '2030-01-01');
assert(!r.skipped && r.used === 500, 'Second add aggregate incorrect');
r = update(600, 1000, '2030-01-01');
assert(r.skipped, 'Should skip over limit');
r = update(400, 1000, '2030-01-02');
assert(!r.skipped && r.used === 400, 'New day baseline');
const data = load();
assert(Object.keys(data.days).length === 2, 'Expected two day entries');
console.log('Ledger tests passed:', data);
