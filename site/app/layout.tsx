export const metadata = {
  title: 'Chat Logs',
  description: 'Browse GPT chat transcripts from this repo'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, Arial, sans-serif', color: '#0f172a', margin: 0 }}>
        <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Chat Logs</h1>
        </header>
        <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px' }}>{children}</main>
        <footer style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', color: '#64748b' }}>
          Built from markdown in <code>logs/</code>
        </footer>
      </body>
    </html>
  );
}