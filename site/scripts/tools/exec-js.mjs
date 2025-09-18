#!/usr/bin/env node
import vm from 'node:vm';

export function execJS(code, input = undefined, timeoutMs = 1500) {
  const sandbox = {
    console: { log: (...args) => sandbox.__logs.push(args.map(String).join(' ')) },
    __logs: [],
    input,
    Math,
    JSON,
    Date,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Map,
    Set,
  };
  const context = vm.createContext(sandbox, { name: 'ai-exec', codeGeneration: { strings: true, wasm: false } });
  const wrapped = `(() => { ${code}\n })()`;
  const script = new vm.Script(wrapped, { filename: 'snippet.js' });
  const result = script.runInContext(context, { timeout: timeoutMs });
  return { result, logs: sandbox.__logs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = process.argv[2] || '';
  try { const out = execJS(code); console.log(JSON.stringify(out)); } catch (e) { console.error('Exec error:', e?.message || e); process.exit(1); }
}
