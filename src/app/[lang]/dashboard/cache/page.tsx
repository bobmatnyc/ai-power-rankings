import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { CacheManagementClient } from "./cache-client";

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic';

export default function CacheManagementPage() {
  return (
    <DashboardLayout
      title="Cache Management"
      description="Manage static JSON cache files for offline functionality"
      backHref="/en"
    >
      <CacheManagementClient />
    </DashboardLayout>
  );
}
