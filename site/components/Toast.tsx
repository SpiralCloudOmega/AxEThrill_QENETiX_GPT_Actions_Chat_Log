"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ToastItem = { id: number; message: string; type?: 'info' | 'success' | 'error'; ttlMs?: number };

type ToastContextType = {
  toast: (message: string, opts?: { type?: ToastItem['type']; ttlMs?: number }) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(){
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: (_msg: string) => {} };
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }){
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, opts?: { type?: ToastItem['type']; ttlMs?: number }) => {
    const id = idRef.current++;
    const ttlMs = opts?.ttlMs ?? 1500;
    const type = opts?.type ?? 'info';
    setItems((list) => [...list, { id, message, type, ttlMs }]);
    window.setTimeout(() => remove(id), ttlMs);
  }, [remove]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((t) => (
          <div key={t.id} style={{
            background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#f1f5f9',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            padding: '8px 12px',
            minWidth: 200,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
