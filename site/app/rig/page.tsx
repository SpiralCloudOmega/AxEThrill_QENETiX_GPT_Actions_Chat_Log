import fs from 'node:fs';
import path from 'node:path';

type Rig = {
  motherboard?: string;
  cpu?: string;
  gpu?: string;
  ram?: string;
  audio?: string;
  storage?: string[];
  display?: string;
  notes?: string;
};

function sitePublic() {
  return path.join(process.cwd(), 'public');
}

function readJson<T>(file: string): T | null {
  try {
    const full = path.join(sitePublic(), file);
    if (!fs.existsSync(full)) return null;
    return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
  } catch {
    return null;
  }
}

export const dynamic = 'error';
export const dynamicParams = false;

export default async function RigPage() {
  const rig = readJson<Rig>('rig.json');
  const status = readJson<any>('rig-status.json');

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Rig</h2>
      {!rig && (
        <p style={{ color: '#64748b' }}>
          No rig.json found. Create <code>site/public/rig.json</code> with your hardware details.
        </p>
      )}
      {rig && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <h3>Hardware</h3>
            <ul>
              {rig.motherboard && <li><strong>Motherboard:</strong> {rig.motherboard}</li>}
              {rig.cpu && <li><strong>CPU:</strong> {rig.cpu}</li>}
              {rig.gpu && <li><strong>GPU:</strong> {rig.gpu}</li>}
              {rig.ram && <li><strong>RAM:</strong> {rig.ram}</li>}
              {rig.audio && <li><strong>Audio:</strong> {rig.audio}</li>}
              {rig.display && <li><strong>Display:</strong> {rig.display}</li>}
              {rig.storage && rig.storage.length > 0 && (
                <li><strong>Storage:</strong>
                  <ul>
                    {rig.storage.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </li>
              )}
              {rig.notes && <li><strong>Notes:</strong> {rig.notes}</li>}
            </ul>
          </div>
          <div>
            <h3>Status</h3>
            {!status && <p style={{ color: '#64748b' }}>No status yet. Run the probe script to generate <code>site/public/rig-status.json</code>.</p>}
            {status && (
              <div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Last probe: {status.timestamp || 'unknown'}</div>
                <ul>
                  {status.kernel && <li><strong>Kernel:</strong> {status.kernel}</li>}
                  {status.distro && <li><strong>Distro:</strong> {status.distro}</li>}
                  {status.nvidia && <li><strong>NVIDIA:</strong> {status.nvidia}</li>}
                  {status.cpu && <li><strong>CPU:</strong> {status.cpu}</li>}
                  {status.memory && <li><strong>Memory:</strong> {status.memory}</li>}
                  {status.gpu && <li><strong>GPU:</strong> {status.gpu}</li>}
                  {status.audio && <li><strong>Audio:</strong> {status.audio}</li>}
                  {status.storage && Array.isArray(status.storage) && (
                    <li><strong>Storage:</strong>
                      <ul>
                        {status.storage.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </li>
                  )}
                  {status.openrgb && <li><strong>OpenRGB:</strong> {status.openrgb}</li>}
                  {status.display && <li><strong>Display:</strong> {status.display}</li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ marginTop: 24, fontSize: 14, color: '#64748b' }}>
        Tip: Schedule the probe to run daily on your Linux rig (systemd timer or cron) and commit the updated JSON/logs.
      </div>
    </div>
  );
}
