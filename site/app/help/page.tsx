export const dynamic = 'error';
export const dynamicParams = false;

export default function HelpPage() {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Help & GitHub Tips</h2>
      <p>Quick, human-friendly reminders to make working in this repo smoother.</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 16px' }}>
        <a href="/search" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>Search</a>
        <a href="/tags" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>Tags</a>
        <a href="/memory" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>Memory</a>
        <a href="/agents" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>Agents</a>
        <a href="/ai" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>AI</a>
        <a href="/ui/clip/" style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, textDecoration: 'none' }}>Clip (Scraper UI)</a>
      </div>

      <h3>Everyday Git</h3>
      <ul>
        <li><strong>Create/switch branch:</strong> git checkout -b feature/thing</li>
        <li><strong>Stage + amend last commit:</strong> git add -A, then git commit --amend --no-edit</li>
        <li><strong>Interactive rebase:</strong> git rebase -i main (squash/fixup tidy history)</li>
        <li><strong>Cherry-pick:</strong> git cherry-pick &lt;hash&gt;</li>
        <li><strong>Stash work:</strong> git stash push -m "wip"; later: git stash pop</li>
        <li><strong>Undo safely:</strong> git revert &lt;hash&gt; (creates a new commit)</li>
        <li><strong>Time machine:</strong> git reflog (find lost commits/heads)</li>
        <li><strong>Bisect bug:</strong> git bisect start → good/bad to locate regression</li>
      </ul>

      <h3>GitHub niceties</h3>
      <ul>
        <li><strong>Link issues:</strong> include text like “Fixes #123” in a commit or PR to auto-close on merge</li>
        <li><strong>PR description:</strong> add steps to test, screenshots, and “Why” not just “What”</li>
        <li><strong>Code owners:</strong> add CODEOWNERS to request reviews from the right folks</li>
        <li><strong>Templates:</strong> issue and PR templates speed up good reports and reviews</li>
      </ul>

      <h3>Markdown</h3>
      <ul>
        <li>Headings (# Title), code fence (```), tables (| A | B |)</li>
        <li>Fence language hints syntax highlighting (```ts, ```bash)</li>
        <li>Checklists: - [ ] task 1</li>
      </ul>

      <h3>Keyboard tips in this site</h3>
      <ul>
        <li>Search: press “/” or “s” to focus, “Esc” to clear, “Enter” to open top result</li>
        <li>Home hotkeys: “/” or “s” = Search, “a” = AI, “g” = Agents, “m” = Memory, “r” = random log, “t” = top</li>
        <li>Tags page filter: press “/” to focus the filter box, “Esc” to clear</li>
        <li>Log page: Arrow keys to move, “t” to scroll to top</li>
      </ul>

      <h3>Recent searches</h3>
      <ul>
        <li>Your last 10 searches are saved locally (per‑browser) and shown on the Search page and Home.</li>
        <li>Click a recent term to reopen Search prefilled with that query; use “Clear” to reset.</li>
      </ul>

      <h3>Toasts and feedback</h3>
      <ul>
        <li>Copy buttons show a quick toast (“Link copied”) and a small inline “Copied!” hint</li>
        <li>Pin/unpin tag actions pop a toast so you don’t lose context</li>
      </ul>

      <h3>Favorites and pinned tags</h3>
      <ul>
        <li>Favorites on Home are stored locally in your browser via localStorage.</li>
        <li>Pinned tags on the Tags page are also local to your browser and help surface your go‑to topics.</li>
        <li>Both features are per‑device and private; they don’t change the repository.</li>
      </ul>

      <h3>Tags and normalization</h3>
      <ul>
        <li>Tags are treated case‑insensitively and normalized (lowercase, trimmed) for consistency across pages and indices.</li>
        <li>If your logs contain mixed‑case tags, they’ll be grouped together in tag views and suggestions.</li>
      </ul>

      <h3>AI assistant</h3>
      <p>
        Prefer Gemini for friendly explanations when available. Offline RAG works without keys. You can ask questions, analyze files, run small JS, and save transcripts into logs/.
        Start the local API and point your other AI tools at it. Endpoints: /ask, /rag, /tool, /fs/read, /fs/write, /make/ui.
        Try the Clip UI at <code>/ui/clip/</code> to scrape pages into memory.
      </p>

      <h3>Next options (self-learning)</h3>
      <p>
        The site suggests “Next options” (tags) based on simple co‑occurrence learning from your logs. A small script builds a policy at <code>/learn-policy.json</code>:
      </p>
      <ul>
        <li>Regenerated automatically during prebuild so static exports include fresh suggestions.</li>
        <li>Refreshed by the nightly maintenance after adding a summary capsule.</li>
        <li>Client components read it at runtime and show tag pills seeded by the current context.</li>
      </ul>

      <h3>Related logs ranking</h3>
      <p>
        Related logs are computed client‑side from the retrieval capsule using cosine similarity over TF‑IDF vectors.
        We add a small boost when items share tags (Jaccard overlap), so posts with similar topics are favored.
      </p>

      <h3>UI configuration</h3>
      <p>
        Some small knobs are configurable via <code>/ui/config.json</code> in the public directory:
      </p>
      <ul>
        <li><strong>related</strong>: {`{ tagWeight, k }`} — tag overlap boost and max related items.</li>
        <li><strong>nextOptions</strong>: {`{ max, fallbackTop }`} — number of suggestion pills and fallback top-tags count.</li>
        <li><strong>search</strong>: {`{ maxResults, maxTagChips }`} — search result limit and max tag chips shown.</li>
      </ul>

      <h3>Tag aliases</h3>
      <p>
        You can unify synonymous or noisy tags by declaring aliases in <code>/ui/config.json</code>. Builders apply aliasing during indexing and learning so the whole site stays consistent.
      </p>
      <ul>
        <li>Place mappings under <code>"tagAliases"</code>, for example: <code>{`{ "nvidia code:": "nvidia", "nvidia code": "nvidia" }`}</code>.</li>
        <li>Keys and values are normalized (lowercased and trimmed) before applying.</li>
        <li>Safe to change anytime; re-run the prebuild to regenerate indices with the new mapping.</li>
      </ul>
    </div>
  );
}
