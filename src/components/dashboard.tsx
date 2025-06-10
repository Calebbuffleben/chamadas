'use client';

interface DashboardProps {
  orgId: string;
}

export function Dashboard({ orgId }: DashboardProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>Organization ID: {orgId}</p>
    </div>
  );
} 