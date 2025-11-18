'use client';

import { useState } from 'react';
import type { OrganizationSummary } from '@/lib/auth/types';
import { useAuth } from '@/lib/auth';

export function SelectOrganizationClient({
  organizations,
  currentOrganizationId,
}: {
  organizations: OrganizationSummary[];
  currentOrganizationId: string;
}) {
  const { selectOrganization } = useAuth();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (membershipId: string) => {
    setPendingId(membershipId);
    setError(null);
    try {
      await selectOrganization(membershipId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar a organização');
    } finally {
      setPendingId(null);
    }
  };

  if (organizations.length === 0) {
    return <p>Você ainda não possui organizações disponíveis.</p>;
  }

  return (
    <div className="lk-grid" style={{ gap: '1rem' }}>
      {organizations.map((org) => {
        const active = org.organizationId === currentOrganizationId;
        return (
          <article
            key={org.membershipId}
            className={`lk-card ${active ? 'lk-card-active' : ''}`}
            style={{ padding: '1.25rem' }}
          >
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0 }}>{org.name}</h2>
                <small>{org.slug}</small>
              </div>
              <span className="lk-badge">{org.role}</span>
            </header>
            <p style={{ marginTop: '0.75rem' }}>Plano: {org.plan ?? 'standard'}</p>
            <button
              className="lk-button"
              onClick={() => handleSelect(org.membershipId)}
              disabled={pendingId !== null || active}
            >
              {active ? 'Ativa' : 'Selecionar'}
            </button>
          </article>
        );
      })}
      {error && (
        <p style={{ color: 'var(--lk-danger3)', marginTop: '0.5rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}


