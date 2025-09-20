import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'error';
export const dynamicParams = false;

function pub(file: string) {
  return path.join(process.cwd(), 'public', file);
}

function readJson(file: string) {
  const p = pub(file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export default async function GraphPage() {
  const commits = readJson('commits.json') || [];
  const filesMap = readJson('commit-files.json') || {};
  const tree = readJson('repo-tree.json') || [];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Repo Graph & Tree</h2>
      <section style={{ marginBottom: 24 }}>
        <h3>Commit Graph (last {commits.length} commits)</h3>
        {commits.length === 0 && <p style={{ color: '#64748b' }}>No commit data available. Run prebuild locally with git present.</p>}
        <div style={{ fontFamily: 'ui-mono, Menlo, monospace', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Graph</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Hash</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Subject</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Author</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Files</th>
              </tr>
            </thead>
            <tbody>
              {commits.map((c: any, _i: number) => {
                const lane = (c.parents?.length || 0) > 1 ? 2 : (c.parents?.length || 0);
                const files = filesMap[c.hash] || [];
                return (
                  <tr key={c.hash} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      {/* extremely simple lane dot */}
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 10, background: ['#22c55e','#0ea5e9','#a855f7'][lane] || '#64748b' }} />
                    </td>
                    <td style={{ padding: '6px 8px', fontFamily: 'ui-mono, Menlo, monospace' }}>{c.hash.slice(0, 7)}</td>
                    <td style={{ padding: '6px 8px' }}>{c.subject}</td>
                    <td style={{ padding: '6px 8px' }}>{c.author}</td>
                    <td style={{ padding: '6px 8px' }}>{new Date(c.date).toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', fontSize: 12, color: '#64748b' }}>{files.slice(0, 5).join(', ')}{files.length > 5 ? '…' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Repository Tree</h3>
        {(!tree || tree.length === 0) && <p style={{ color: '#64748b' }}>No tree data available.</p>}
        <TreeViewer nodes={tree} />
      </section>
    </div>
  );
}

function iconForExt(ext: string) {
  const map: Record<string, string> = {
    ts: '#3178c6', tsx: '#3178c6', js: '#f59e0b', jsx: '#f59e0b', json: '#10b981', md: '#22c55e', css: '#06b6d4', mjs: '#0ea5e9'
  };
  return map[ext] || '#64748b';
}

function TreeViewer({ nodes }: { nodes: any[] }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
      {nodes.map((n) => <TreeNode key={n.path} node={n} />)}
    </div>
  );
}

function TreeNode({ node }: { node: any }) {
  if (node.type === 'file') {
    return (
      <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, background: iconForExt(node.ext), borderRadius: 2, display: 'inline-block' }} />
        <span>{node.name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{node.size} B</span>
      </div>
    );
  }
  return <FolderNode node={node} />;
}

function FolderNode({ node }: { node: any }) {
  const id = `chk-${node.path.replace(/[^a-z0-9]/gi, '-')}`;
  return (
    <div style={{ marginLeft: 8 }}>
      <div style={{ padding: '4px 8px', background: '#f8fafc', borderRadius: 6, marginTop: 4 }}>
        <input id={id} type="checkbox" defaultChecked style={{ marginRight: 8 }} />
        <label htmlFor={id} style={{ cursor: 'pointer' }}>📁 {node.name}</label>
      </div>
      <div style={{ marginLeft: 20 }}>
        {node.children?.map((c: any) => <TreeNode key={c.path} node={c} />)}
      </div>
    </div>
  );
}
