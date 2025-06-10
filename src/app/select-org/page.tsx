import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SelectOrgPage() {
  const session = await auth();
  const { orgId } = session;

  // If user has an org, redirect to their dashboard
  if (orgId) {
    redirect(`/${orgId}/dashboard`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Selecione uma Organização</h1>
        <p className="text-gray-600">
          Por favor, selecione ou crie uma organização para continuar.
        </p>
      </div>
    </div>
  );
} 