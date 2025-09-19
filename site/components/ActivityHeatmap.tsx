"use client";

import Link from 'next/link';
import { useMemo } from 'react';

export type DayCount = { date: string; count: number };

function weeksBack(n: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (n * 7 - (today.getDay() + 6) % 7));
  const days: string[] = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function color(count: number) {
  if (count <= 0) return '#e2e8f0';
  if (count === 1) return '#bae6fd';
  if (count <= 3) return '#7dd3fc';
  if (count <= 6) return '#38bdf8';
  return '#0ea5e9';
}

export default function ActivityHeatmap({ items }: { items: { relPath: string }[] }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const parts = it.relPath.split('/'); // logs/YYYY/MM/DD/file.md
      if (parts.length >= 4) {
        const y = parts[1], m = parts[2], d = parts[3];
        const key = `${y}-${m}-${d}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [items]);

  const days = weeksBack(12);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6 }}>
        {Array.from({ length: 12 }).map((_, wi) => {
          const weekDays = days.slice(wi * 7, wi * 7 + 7);
          return (
            <div key={wi} style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 6 }}>
              {weekDays.map((date) => {
                const c = counts.get(date) || 0;
                const [y, m, d] = date.split('-');
                const href = `/logs/${y}/${m}/${d}`;
                return (
                  <Link key={date} href={href} title={`${date}: ${c} logs`} style={{ width: 12, height: 12, background: color(c), borderRadius: 2, display: 'inline-block' }} />
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Activity (last 12 weeks)</div>
    </div>
  );
}
