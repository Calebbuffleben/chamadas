'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useState } from 'react';

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const presetToken = searchParams?.get('token') ?? '';
  return (
    <main data-lk-theme="default" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="lk-card" style={{ padding: '2rem', width: '100%', maxWidth: 480 }}>
        <h1>Aceitar convite</h1>
        <AcceptInviteForm presetToken={presetToken} />
      </div>
    </main>
  );
}

function AcceptInviteForm({ presetToken }: { presetToken: string }) {
  const router = useRouter();
  const { setSession } = useAuth();
  const [formState, setFormState] = useState({
    token: presetToken,
    name: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload?.message ?? 'Convite inválido ou expirado');
      }
      const session = await response.json();
      setSession(session);
      router.replace('/select-organization');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível aceitar o convite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="lk-stack">
      <label className="lk-field">
        <span>Token</span>
        <input
          name="token"
          value={formState.token}
          onChange={handleChange}
          placeholder="Cole o token recebido por email"
          required
        />
      </label>
      <label className="lk-field">
        <span>Seu nome</span>
        <input name="name" value={formState.name} onChange={handleChange} required />
      </label>
      <label className="lk-field">
        <span>Defina uma senha</span>
        <input
          name="password"
          type="password"
          value={formState.password}
          onChange={handleChange}
          required
        />
      </label>
      {error && <p style={{ color: 'var(--lk-danger3)' }}>{error}</p>}
      <button className="lk-button" type="submit" disabled={submitting}>
        {submitting ? 'Aceitando...' : 'Aceitar convite'}
      </button>
      <p style={{ textAlign: 'center' }}>
        Já possui acesso? <a href="/login">Ir para login</a>.
      </p>
    </form>
  );
}

