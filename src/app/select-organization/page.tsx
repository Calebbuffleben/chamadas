import { OrganizationSwitcher } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SelectOrganizationPage() {
  const session = await auth();
  const { userId, orgId } = session;

  // If user is not signed in, redirect to sign in
  if (!userId) {
    redirect("/sign-in");
  }

  // If user already has an organization selected, redirect to dashboard
  if (orgId) {
    redirect(`/${orgId}/dashboard`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-8 text-2xl font-bold">Select an Organization</h1>
        <OrganizationSwitcher 
          afterCreateOrganizationUrl="/:id/dashboard"
          afterSelectOrganizationUrl="/:id/dashboard"
          hidePersonal
        />
      </div>
    </div>
  );
} 