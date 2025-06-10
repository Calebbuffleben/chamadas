import { OrganizationSwitcher } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgId: string };
}) {
  const session = await auth();
  const { orgId } = session;

  // If no organization is selected, redirect to organization selection
  if (!orgId) {
    redirect("/select-organization");
  }

  // If trying to access a different organization, redirect to selected organization
  if (orgId !== params.orgId) {
    redirect(`/${orgId}/dashboard`);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <OrganizationSwitcher 
              afterCreateOrganizationUrl={(org) => `/${org.id}/dashboard`}
              afterSelectOrganizationUrl={(org) => `/${org.id}/dashboard`}
              hidePersonal
            />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
} 