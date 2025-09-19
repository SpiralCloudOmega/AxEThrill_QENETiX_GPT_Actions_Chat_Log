export const dynamic = 'error';
export const dynamicParams = false;

export default function AIPage() {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>AI Assistant</h2>
      <p>
        The repository ships with a local-first AI that can search logs, call Gemini for clearer explanations,
        analyze files, run small JS, and scaffold UI. Transcripts save back into <code>logs/</code>.
      </p>
      <h3>CLI</h3>
      <ul>
        <li>Memory (capsules): <code>node site/scripts/ai-cli.mjs tool memory add --title "GPU Fact" --content "RTX 4090 has 24GB" --tags nvidia,gpu</code></li>
        <li>Ask: <code>npm run -s --prefix site ai:ask -- "Explain Vulkan validation layers"</code></li>
        <li>Chat: <code>npm run -s --prefix site ai:chat -- --route</code></li>
        <li>Tools: add <code>--analyze --file path</code> or <code>--code "js"</code></li>
        <li>Shell (allowlisted): <code>node site/scripts/ai-cli.mjs tool sh --cmd "ls logs/2025/09"</code></li>
        <li>Grep (safe, single-file): <code>node site/scripts/ai-cli.mjs tool grep --pattern "vulkan" --file logs/2025/09/17/vulkan-test.md</code></li>
        <li>Scrape URL → memory: <code>node site/scripts/ai-cli.mjs tool scrape url --url https://example.com --save --tags web,doc</code></li>
        <li>Scrape file: <code>node site/scripts/ai-cli.mjs tool scrape file --file logs/2025/09/17/sample.md</code></li>
        <li>Generate UI: <code>node site/scripts/ai-cli.mjs make ui --name demo --spec "search and tags"</code></li>
      </ul>
      <h3>Multi‑agent Orchestrator</h3>
      <p>
        A lightweight multi‑agent runner chains roles: Receptionist → Planner → Frontend/Backend/Networking/Security
        and writes a Markdown report to <code>logs/incoming/</code> (use <code>--route</code> to move it under dated logs).
      </p>
      <ul>
        <li>Run with inline spec: <code>npm run -s --prefix site ai:agents -- "Build a tiny UI to browse logs by tag and date"</code></li>
        <li>Run from file: <code>npm run -s --prefix site ai:agents:file -- logs/inbox/spec.md</code></li>
        <li>Provider: defaults to Gemini/OpenAI if keys set, else local. Add <code>--provider=gemini|openai|rag</code>.</li>
      </ul>
      <h3>Agent Zero (prompt‑only)</h3>
      <p>
        A free, prompt‑only multi‑step graph that runs entirely via LLM prompts (Gemini‑first) without any code execution or tools.
        It’s great for brainstorming, planning, and refining specs. Outputs a markdown report to <code>logs/incoming/</code>.
      </p>
      <ul>
        <li>Inline: <code>npm run -s --prefix site ai:agent-zero -- "Design a minimal logs dashboard and a rollout plan"</code></li>
        <li>From file: <code>npm run -s --prefix site ai:agent-zero:file -- logs/inbox/spec.md</code></li>
        <li>Custom graph: pass <code>--graph</code> with JSON or a path to a JSON file defining nodes and inputs.</li>
      </ul>
      <h3>HTTP API</h3>
      <p>Start: <code>npm run -s --prefix site ai:serve -- --port=11435</code>. Endpoints: /ask, /rag, /tool, /fs/read, /fs/write, /make/ui, and SSE <code>/stream</code>.</p>
      <p>
        Shell via HTTP: POST <code>/tool</code> with body <code>{'{'}"action":"exec-sh","cmd":"echo hello"{'}'}</code>. Allowed commands: echo, uname, node, ls, cat, wc, head, tail. Paths are constrained to <code>logs/</code> and <code>site/public/</code>.
      </p>
  <h4>Streaming demo</h4>
  <p>
    Hit <code>/stream?q=your+question</code> after starting the server. Youll receive <code>text/event-stream</code> events like:
  </p>
  <pre style={{whiteSpace:'pre-wrap',background:'#111',padding:12,borderRadius:8}}>
{`event: chunk
data: {"text":"Hello"}

event: chunk
data: {"text":" world"}

event: done
data: {"final":"Hello world"}`}
  </pre>
      <p>
        Grep via HTTP: POST <code>/tool</code> with body <code>{'{'}"action":"grep","pattern":"vulkan","file":"logs/2025/09/17/vulkan-test.md"{'}'}</code>.
        Streaming: GET <code>/stream?q=your+question</code> returns <code>text/event-stream</code> chunks for simple live updates.
      </p>
      <p>
        Memory via HTTP: POST <code>/tool</code> with action <code>memory:add</code>, <code>memory:build</code>, <code>memory:list</code>, or <code>memory:search</code>.
        Example add: <code>{'{'}"action":"memory:add","title":"GPU Fact","content":"RTX 4090 has 24GB","tags":["nvidia","gpu"]{'}'}</code>
      </p>
      <p>
        Scraper via HTTP: POST <code>/tool</code> with <code>"action":"scrape:url","url":"https://example.com","save":true,"tags":["web","doc"]</code> or <code>"action":"scrape:file","file":"logs/2025/09/17/sample.md"</code>.
      </p>
      <h3>Providers</h3>
      <p>Defaults to Gemini if <code>GEMINI_API_KEY</code> is set; otherwise OpenAI if <code>OPENAI_API_KEY</code> is set; else offline RAG.</p>
      <h3>Extras</h3>
      <ul>
        <li>
          Memory context in Ask/Chat: include top capsules automatically. Flags: <code>--no-memory</code> to disable, <code>--mem-k</code> to set count.
        </li>
        <li>
          Clip mini UI: <a href="/ui/clip/" target="_blank">/ui/clip/</a> scrapes a URL and saves to memory via the HTTP <code>/tool</code> endpoint.
        </li>
        <li>
          Browse memories at <a href="/memory" target="_blank">/memory</a> (backed by <code>public/memory-index.json</code> built during prebuild).
        </li>
      </ul>
    </div>
  );
}
