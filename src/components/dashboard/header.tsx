import { UserButton } from "@clerk/nextjs";
import { useOrganization } from "@clerk/nextjs";

export function DashboardHeader() {
  const { organization } = useOrganization();

  if (!organization) return null;

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{organization.name}</p>
      </div>
      <UserButton afterSignOutUrl="/" />
    </div>
  );
} 