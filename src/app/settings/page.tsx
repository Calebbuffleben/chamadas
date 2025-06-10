import { ZoomConnect } from "@/components/zoom-connect";

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="grid gap-6">
        <ZoomConnect />
      </div>
    </div>
  );
} 