import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'error';
export const revalidate = false;

function loadHealth(){
  try {
    const p = path.join(process.cwd(), 'public', 'health.json');
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch {}
  return null;
}

export default function HealthPage(){
  const health = loadHealth();
  return (
    <div>
      <h1>Health</h1>
      {!health && <p>No health.json found. Run prebuild.</p>}
      {health && (
        <>
          <p style={{fontSize:14,color:'#475569'}}>Snapshot of build + content metrics.</p>
          <table style={{ borderCollapse:'collapse', fontSize:14 }}>
            <tbody>
              {Object.entries(health).map(([k,v]) => (
                <tr key={k}>
                  <th style={{ textAlign:'left', padding:'4px 8px', borderBottom:'1px solid #e2e8f0' }}>{k}</th>
                  <td style={{ padding:'4px 8px', borderBottom:'1px solid #e2e8f0', fontFamily:'ui-monospace,monospace' }}>
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop:16 }}><a href="/health.json">Raw JSON</a></p>
        </>
      )}
      <style>{`table tr:nth-child(even){background:#f8fafc;}@media (prefers-color-scheme:dark){table tr:nth-child(even){background:#0f172a;}th{color:#e2e8f0;}td{color:#e2e8f0;border-bottom-color:#1e293b;} }`}</style>
    </div>
  );
}
