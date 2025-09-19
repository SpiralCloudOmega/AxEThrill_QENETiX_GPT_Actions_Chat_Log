#!/usr/bin/env node
// Minimal MCP integration smoke test: starts server in-process, invokes methods, asserts basics.
import { fork } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';

const serverPath = path.join(process.cwd(), 'scripts', 'mcp-server.mjs');
const PORT = 18222;
process.env.MCP_API_KEY = 'testkey';

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/mcp', method: 'POST', headers: { 'content-type':'application/json', 'x-api-key':'testkey' } }, res => {
      let data=''; res.on('data', c=>data+=c); res.on('end', ()=>{
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ jsonrpc:'2.0', id: Math.random(), method, params }));
    req.end();
  });
}

function assert(cond, msg){ if(!cond){ console.error('FAIL', msg); process.exit(1);} }

const child = fork(serverPath, ['--port', String(PORT)], { stdio: 'inherit' });

async function run(){
  // wait briefly for server
  await new Promise(r=>setTimeout(r, 600));
  const logsList = await rpc('logs.list', { limit: 2 });
  assert(!logsList.error, 'logs.list returned error');
  const memoryList = await rpc('memory.list', { limit: 2 });
  assert(!memoryList.error, 'memory.list returned error');
  const ledger = await rpc('token.ledger');
  assert(!ledger.error && ledger.result && typeof ledger.result.total === 'number', 'token.ledger bad result');
  // write methods
  const ingestAdd = await rpc('ingest.add', { title: 'Test Ingest', content: 'Some content from test', tags: ['test'] });
  assert(!ingestAdd.error && ingestAdd.result.ok, 'ingest.add failed');
  const memAdd = await rpc('memory.add', { title: 'Test Capsule', content: 'capsule body', tags:['caps'], summary:'test' });
  assert(!memAdd.error && memAdd.result.id, 'memory.add failed');
  const summarize = await rpc('agent.summarize', { query: 'test', limit: 3 });
  assert(!summarize.error && summarize.result && summarize.result.summary, 'agent.summarize failed');
  console.log('MCP integration tests passed');
}

run().catch(e=>{ console.error(e); process.exit(1); }).finally(()=>{
  setTimeout(()=> child.kill('SIGTERM'), 300);
});
