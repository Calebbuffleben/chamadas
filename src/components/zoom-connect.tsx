import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

export function ZoomConnect() {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/zoom/connect");
      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error("Failed to connect Zoom:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Zoom</CardTitle>
        <CardDescription>
          Connect your Zoom account to sync your meetings and track attendance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleConnect} disabled={isLoading}>
          {isLoading ? "Connecting..." : "Connect Zoom Account"}
        </Button>
      </CardContent>
    </Card>
  );
} 