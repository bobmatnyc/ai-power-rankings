import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { CacheManagementClient } from "./cache-client";

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
