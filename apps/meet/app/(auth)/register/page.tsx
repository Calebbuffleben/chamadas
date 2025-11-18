'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  return (
    <main data-lk-theme="default" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '2rem' }} className="lk-card">
        <h1 style={{ marginBottom: '1rem' }}>Criar conta</h1>
        <RegisterForm />
      </div>
    </main>
  );
}

function RegisterForm() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [formState, setFormState] = useState({
    organizationName: '',
    organizationSlug: '',
    name: '',
    email: '',
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload?.message ?? 'Falha ao registrar');
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
        <span>Nome da organização</span>
        <input
          name="organizationName"
          value={formState.organizationName}
          onChange={handleChange}
          required
        />
      </label>
      <label className="lk-field">
        <span>Slug da organização</span>
        <input
          name="organizationSlug"
          value={formState.organizationSlug}
          onChange={handleChange}
          required
        />
      </label>
      <label className="lk-field">
        <span>Seu nome</span>
        <input name="name" value={formState.name} onChange={handleChange} required />
      </label>
      <label className="lk-field">
        <span>Email</span>
        <input
          name="email"
          type="email"
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
        {submitting ? 'Criando...' : 'Criar conta'}
      </button>
      <p style={{ textAlign: 'center' }}>
        Já possui conta? <a href="/login">Faça login</a>.
      </p>
    </form>
  );
}

