'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/client-utils';
import { useAuth } from '@/lib/auth';

export default function Page() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <main data-lk-theme="default" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <p>Carregando...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main data-lk-theme="default" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="lk-card" style={{ padding: '2rem', textAlign: 'center', maxWidth: 420 }}>
          <h1>Live Meeting</h1>
          <p>Faça login ou crie uma conta para iniciar reuniões com sua organização.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
            <a className="lk-button" href="/login">
              Entrar
            </a>
            <a className="lk-button lk-button-secondary" href="/register">
              Criar conta
            </a>
          </div>
        </div>
      </main>
    );
  }

  return <AuthenticatedDashboard />;
}

function AuthenticatedDashboard() {
  const router = useRouter();
  const { session, selectOrganization } = useAuth();
  const [meetingId, setMeetingId] = useState(generateRoomId());
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

  if (!session) {
    return null;
  }

  const handleStart = () => {
    if (!meetingId) {
      return;
    }
    router.push(`/rooms/${meetingId}`);
  };

  const handleSwitch = async (membershipId: string) => {
    setSwitchingOrgId(membershipId);
    try {
      await selectOrganization(membershipId);
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const activeOrg =
    session.organizations.find((org) => org.organizationId === session.currentOrganizationId) ??
    session.organizations[0];

  return (
    <main data-lk-theme="default" style={{ minHeight: '100vh', padding: '2rem' }}>
      <section style={{ maxWidth: 720, margin: '0 auto' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ marginBottom: '0.25rem' }}>Olá, {session.user.name ?? session.user.email}</h1>
          <p>Organização ativa: {activeOrg?.name ?? session.user.organization.name}</p>
        </header>

        <div className="lk-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Iniciar uma reunião</h2>
          <p>Defina um identificador único para convidar outras pessoas.</p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <input
              className="lk-field-input"
              value={meetingId}
              onChange={(event) => setMeetingId(event.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <button className="lk-button" onClick={handleStart}>
              Entrar na sala
            </button>
          </div>
        </div>

        <section style={{ marginTop: '2rem' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ marginBottom: 0 }}>Organizações</h3>
              <small>Selecione outra organização para visualizar reuniões e convites.</small>
            </div>
            <a className="lk-button lk-button-secondary" href="/select-organization">
              Gerenciar tudo
            </a>
          </header>
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
            {session.organizations.map((org) => {
              const active = org.organizationId === session.currentOrganizationId;
              return (
                <article
                  key={org.membershipId}
                  className="lk-card"
                  style={{ padding: '1rem 1.25rem', border: active ? '1px solid var(--lk-accent6)' : undefined }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ marginBottom: 0 }}>{org.name}</h4>
                      <small>{org.slug}</small>
                    </div>
                    <span className="lk-badge">{org.role}</span>
                  </div>
                  <p style={{ marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                    Plano: {org.plan ?? 'standard'} • {org.isDefault ? 'Padrão' : 'Secundária'}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      className="lk-button"
                      disabled={active || switchingOrgId === org.membershipId}
                      onClick={() => handleSwitch(org.membershipId)}
                    >
                      {active ? 'Ativa' : switchingOrgId === org.membershipId ? 'Alternando...' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      className="lk-button lk-button-secondary"
                      onClick={() => router.push(`/rooms/${generateRoomId()}`)}
                    >
                      Criar sala rápida
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
