'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SessionPayload } from './types';

type AuthContextValue = {
  session: SessionPayload | null;
  loading: boolean;
  refresh: () => Promise<void>;
  selectOrganization: (membershipId: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (session: SessionPayload | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchSession(): Promise<SessionPayload | null> {
  const response = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  if (response.ok) {
    return (await response.json()) as SessionPayload;
  }
  return null;
}

export function AuthProvider({
  initialSession,
  children,
}: {
  initialSession: SessionPayload | null;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<SessionPayload | null>(initialSession);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextSession = await fetchSession();
      setSession(nextSession);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectOrganization = useCallback(async (membershipId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/select-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ membershipId }),
      });
      if (!response.ok) {
        throw new Error('Failed to select organization');
      }
      const payload = (await response.json()) as SessionPayload;
      setSession(payload);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      void refresh();
      return;
    }
    const interval = setInterval(() => {
      void refresh();
    }, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session, refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      refresh,
      selectOrganization,
      logout,
      setSession,
    }),
    [session, loading, refresh, selectOrganization, logout, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

