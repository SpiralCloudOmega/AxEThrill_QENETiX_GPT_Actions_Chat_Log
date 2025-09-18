#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.join(process.cwd(), '..'));
const allowedRoots = [
  path.join(repoRoot, 'logs'),
  path.join(repoRoot, 'site', 'public'),
];

function isAllowedPath(p) {
  const r = path.resolve(p);
  return allowedRoots.some((root) => r === root || r.startsWith(root + path.sep));
}

// Allowlist commands; any file path arguments must be within allowedRoots.
const ALLOW_CMDS = new Set(['echo', 'uname', 'node', 'ls', 'cat', 'wc', 'head', 'tail']);

export function execShell(cmdline) {
  // naive split respecting quotes
  const parts = Array.isArray(cmdline) ? cmdline : cmdline.match(/(?:"[^"]*"|'[^']*'|\S+)/g) || [];
  const argv = parts.map((s) => s.replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
  if (argv.length === 0) throw new Error('Empty command');
  const cmd = argv[0];
  if (!ALLOW_CMDS.has(cmd)) throw new Error(`Command not allowed: ${cmd}`);
  // Check file args for simple commands
  const fileArgs = [];
  if (cmd === 'ls' || cmd === 'cat' || cmd === 'wc' || cmd === 'head' || cmd === 'tail') {
    for (const a of argv.slice(1)) if (!a.startsWith('-')) fileArgs.push(a);
  }
  for (const f of fileArgs) {
    const fp = path.isAbsolute(f) ? f : path.join(process.cwd(), f);
    if (!isAllowedPath(fp)) throw new Error(`Path not allowed: ${f}`);
    if (!fs.existsSync(fp)) throw new Error(`No such file: ${f}`);
  }
  try {
    const out = execFileSync(cmd, argv.slice(1), { encoding: 'utf8' });
    return { ok: true, stdout: out, stderr: '', code: 0 };
  } catch (e) {
    return { ok: false, stdout: e.stdout?.toString?.() || '', stderr: e.stderr?.toString?.() || e.message, code: e.status ?? 1 };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const line = process.argv.slice(2).join(' ');
  const res = execShell(line);
  console.log(JSON.stringify(res));
}
