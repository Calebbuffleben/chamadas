'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  return (
    <main data-lk-theme="default" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '2rem' }} className="lk-card">
        <h1 style={{ marginBottom: '1rem' }}>Entrar</h1>
        <LoginForm />
      </div>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    organizationSlug: '',
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload?.message ?? 'Falha ao autenticar');
      }
      const session = await response.json();
      setSession(session);
      router.replace('/select-organization');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="lk-stack">
      <label className="lk-field">
        <span>Organização (slug)</span>
        <input
          name="organizationSlug"
          value={formState.organizationSlug}
          onChange={handleChange}
          required
          placeholder="minha-org"
        />
      </label>
      <label className="lk-field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={formState.email}
          onChange={handleChange}
          required
        />
      </label>
      <label className="lk-field">
        <span>Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={formState.password}
          onChange={handleChange}
          required
        />
      </label>
      {error && (
        <p style={{ color: 'var(--lk-danger3)', marginTop: '0.5rem' }}>
          {error}
        </p>
      )}
      <button className="lk-button" type="submit" disabled={submitting}>
        {submitting ? 'Entrando...' : 'Entrar'}
      </button>
      <p style={{ textAlign: 'center' }}>
        Recebeu um convite? <a href="/accept-invite">Clique aqui</a>.
      </p>
    </form>
  );
}

