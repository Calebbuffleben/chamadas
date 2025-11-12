'use client';

import React from 'react';

type FeedbackPayload = {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  ts: number;
  meetingId: string;
  participantId: string;
  window: { start: number; end: number };
  message: string;
  tips?: string[];
  metadata?: Record<string, unknown>;
};

type Item = FeedbackPayload & { receivedAt: number };

const MAX_ITEMS = 5;
const AUTO_EXPIRE_MS = 15000;

export function FeedbackPanel() {
  const [items, setItems] = React.useState<Item[]>([]);

  React.useEffect(() => {
    const onFeedback = (e: Event) => {
      const ce = e as CustomEvent<FeedbackPayload>;
      const payload = ce.detail;
      if (!payload) return;
      setItems((prev) => {
        const next: Item[] = [{ ...payload, receivedAt: Date.now() }, ...prev];
        if (next.length > MAX_ITEMS) next.length = MAX_ITEMS;
        return next;
      });
    };
    window.addEventListener('host-feedback', onFeedback as EventListener);
    return () => {
      window.removeEventListener('host-feedback', onFeedback as EventListener);
    };
  }, []);

  // Auto expire
  React.useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setItems((prev) => prev.filter((i) => now - i.receivedAt < AUTO_EXPIRE_MS));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
      }}
    >
      {items.map((it) => {
        const borderColor =
          it.severity === 'critical' ? '#ef4444' : it.severity === 'warning' ? '#f59e0b' : '#10b981';
        const bgColor =
          it.severity === 'critical' ? 'rgba(239,68,68,0.08)' : it.severity === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)';
        return (
          <div
            key={it.id}
            style={{
              borderLeft: `4px solid ${borderColor}`,
              background: bgColor,
              color: '#111827',
              padding: '8px 12px',
              borderRadius: 8,
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ textTransform: 'capitalize' }}>{it.type.replace(/_/g, ' ')}</strong>
              <button
                onClick={() => setItems((prev) => prev.filter((p) => p.id !== it.id))}
                aria-label="Dismiss"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 16,
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ×
              </button>
            </div>
            <div style={{ marginTop: 4 }}>{it.message}</div>
            {it.tips && it.tips.length > 0 && (
              <ul style={{ marginTop: 6, paddingLeft: 18, color: '#374151' }}>
                {it.tips.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}


