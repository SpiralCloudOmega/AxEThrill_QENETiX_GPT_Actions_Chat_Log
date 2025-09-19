"use client";
import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'system';
  const saved = window.localStorage.getItem('theme-pref');
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitial);
  useEffect(() => { applyTheme(theme); window.localStorage.setItem('theme-pref', theme); }, [theme]);
  useEffect(() => { applyTheme(theme); }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <label style={{ fontSize: 12, color: '#475569' }}>Theme:</label>
      <select
        aria-label="Theme"
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
        style={{ fontSize: 12, padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: 4, background: 'white' }}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
