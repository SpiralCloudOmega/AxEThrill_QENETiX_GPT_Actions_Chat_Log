import './globals.css';
import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import ThemeToggle from '../components/ThemeToggle';

const ToastProvider = dynamic(() => import('../components/Toast'), { ssr: false });

function baseUrl() {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const isPages = process.env.GITHUB_ACTIONS === 'true';
  return isPages && repo ? `https://${process.env.GITHUB_REPOSITORY?.split('/')[0]}.github.io/${repo}` : 'http://localhost:3000';
}

export const metadata: Metadata = {
  title: {
    default: 'Chat Logs',
    template: '%s | Chat Logs'
  },
  description: 'Browse GPT chat transcripts from this repo',
  applicationName: 'Chat Logs',
  metadataBase: new URL(baseUrl()),
  openGraph: {
    title: 'Chat Logs',
    description: 'Browse GPT chat transcripts from this repo',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: 'Chat Logs',
    description: 'Browse GPT chat transcripts from this repo'
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const repo = process.env.GITHUB_REPOSITORY;
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, Arial, sans-serif', color: '#0f172a', margin: 0 }} data-repo={repo}>
        <ToastProvider>
  <header role="banner" style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>Chat Logs</h1>
            <nav role="navigation" aria-label="Primary" style={{ display: 'flex', gap: 12, fontSize: 14, alignItems: 'center' }}>
              <a href="/" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Home</a>
              <a href="/new" style={{ color: '#0ea5e9', textDecoration: 'none' }}>New</a>
              <a href="/tags" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Tags</a>
              <a href="/graph" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Graph</a>
              <a href="/search" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Search</a>
              <a href="/ai" style={{ color: '#0ea5e9', textDecoration: 'none' }}>AI</a>
              <a href="/agents" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Agents</a>
              <a href="/memory" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Memory</a>
              <a href="/rig" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Rig</a>
              <a href="/help" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Help</a>
              <a href="/feed.xml" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Feed</a>
              <a href="/logs-index.json" style={{ color: '#0ea5e9', textDecoration: 'none' }}>JSON</a>
              <a href="https://github.com/SpiralCloudOmega/AxEThrill_QENETiX_GPT_Actions_Chat_Log" target="_blank" rel="noreferrer" style={{ color: '#0ea5e9', textDecoration: 'none' }}>Repo</a>
              <ThemeToggle />
            </nav>
          </div>
        </header>
  <main role="main" style={{ maxWidth: 960, margin: '0 auto', padding: '24px' }}>{children}</main>
        <footer style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', color: '#64748b' }}>
          Built from markdown in <code>logs/</code>
        </footer>
        </ToastProvider>
      </body>
    </html>
  );
}