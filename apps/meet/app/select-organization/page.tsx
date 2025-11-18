import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { SelectOrganizationClient } from './select-organization.client';

export default async function SelectOrganizationPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  const { organizations, currentOrganizationId } = session;
  return (
    <main data-lk-theme="default" style={{ minHeight: '100vh', padding: '2rem' }}>
      <section style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1>Selecione uma organização</h1>
        <p>Você tem acesso a {organizations.length} organização(ões). Escolha com qual deseja trabalhar agora.</p>
        <SelectOrganizationClient
          organizations={organizations}
          currentOrganizationId={currentOrganizationId}
        />
      </section>
    </main>
  );
}

