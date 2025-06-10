import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";

export function IntegrationStatus() {
  const router = useRouter();
  const { organization } = useOrganization();

  if (!organization) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Connect your meeting platforms</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Microsoft Teams</h3>
            <p className="text-sm text-muted-foreground">Connect your Teams account</p>
          </div>
          <Button onClick={() => router.push(`/api/${organization.id}/microsoft/auth`)}>
            Connect
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Zoom</h3>
            <p className="text-sm text-muted-foreground">Connect your Zoom account</p>
          </div>
          <Button onClick={() => router.push(`/api/${organization.id}/zoom/auth`)}>
            Connect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 