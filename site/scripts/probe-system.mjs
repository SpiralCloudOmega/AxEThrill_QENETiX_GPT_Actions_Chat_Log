#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const siteDir = process.cwd();
const repoRoot = path.join(siteDir, '..');
const publicDir = path.join(siteDir, 'public');
const incomingDir = path.join(repoRoot, 'logs', 'incoming');

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }).trim(); } catch { return ''; }
}

function lsblkSummary() {
  const out = sh('lsblk -o NAME,SIZE,TYPE,MOUNTPOINT -nr');
  return out.split('\n').slice(0, 20).join(' | ');
}

function nvidiaVer() {
  const smi = sh('nvidia-smi --query-gpu=driver_version,name --format=csv,noheader');
  if (!smi) return '';
  const [driver, ...rest] = smi.split(',');
  const name = rest.join(',').trim();
  return `${name} driver ${driver?.trim()}`;
}

function openrgbStatus() {
  const out = sh('openrgb --version');
  return out ? out.split('\n')[0] : '';
}

function distro() {
  const osr = sh('cat /etc/os-release');
  const name = /PRETTY_NAME=\"?([^\n\"]+)/.exec(osr)?.[1] || '';
  return name;
}

function cpu() {
  const lscpu = sh('lscpu');
  const model = /Model name:\s*(.+)/.exec(lscpu)?.[1] || '';
  const cores = /CPU\(s\):\s*(\d+)/.exec(lscpu)?.[1] || '';
  return `${model} (${cores} threads)`;
}

function memory() {
  const mem = sh('free -h');
  const line = mem.split('\n').find((l) => l.startsWith('Mem:')) || '';
  const parts = line.trim().split(/\s+/);
  return parts[1] ? `${parts[1]} total` : '';
}

function audio() {
  const a = sh('aplay -l');
  const first = a.split('\n').find((l) => /card \d+:/.test(l));
  return first || '';
}

function display() {
  const xrandr = sh('xrandr --query');
  const mode = xrandr.split('\n').find((l) => /\*/.test(l));
  return mode ? mode.trim() : '';
}

function nowIso() {
  return new Date().toISOString();
}

async function run() {
  fs.mkdirSync(publicDir, { recursive: true });
  const data = {
    timestamp: nowIso(),
    kernel: sh('uname -r'),
    distro: distro(),
    nvidia: nvidiaVer(),
    cpu: cpu(),
    memory: memory(),
    gpu: sh('lspci | grep -i vga || true'),
    audio: audio(),
    storage: lsblkSummary().split(' | ').filter(Boolean),
    openrgb: openrgbStatus(),
    display: display()
  };
  fs.writeFileSync(path.join(publicDir, 'rig-status.json'), JSON.stringify(data, null, 2));

  // Optional: if --log, also write a markdown snapshot to incoming
  const logFlag = process.argv.includes('--log');
  if (logFlag) {
    fs.mkdirSync(incomingDir, { recursive: true });
    const title = 'System Probe Snapshot';
    const id = `probe-${Date.now()}`;
    const receivedAt = new Date().toLocaleString();
    const tags = 'system,probe,rig';
    const body = `# ${title}\n\nConversation ID: ${id}\nReceived At: ${receivedAt}\nTags: ${tags}\n\nKernel: ${data.kernel}\nDistro: ${data.distro}\nNVIDIA: ${data.nvidia}\nCPU: ${data.cpu}\nMemory: ${data.memory}\nGPU: ${data.gpu}\nAudio: ${data.audio}\nOpenRGB: ${data.openrgb}\nDisplay: ${data.display}\nStorage: ${data.storage.join(', ')}\n`;
    const file = path.join(incomingDir, `probe-${Date.now()}.md`);
    fs.writeFileSync(file, body);
    console.log('Probe snapshot written to', path.relative(repoRoot, file));
  }

  console.log('Wrote', path.relative(siteDir, path.join(publicDir, 'rig-status.json')));
}

run().catch((e) => { console.error(e); process.exit(1); });
