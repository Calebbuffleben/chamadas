import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage({
  params,
}: {
  params: { orgId: string };
}) {
  const session = await auth();
  const { orgId } = session;

  // If no organization is selected, redirect to organization selection
  if (!orgId) {
    redirect("/select-org");
  }

  // If trying to access a different organization, redirect to selected organization
  if (orgId !== params.orgId) {
    redirect(`/${orgId}/dashboard`);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>Organization ID: {orgId}</p>
    </div>
  );
} 