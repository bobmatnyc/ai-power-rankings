import { NewsIngestionTool } from "@/components/admin/news-ingestion-tool";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function NewsIngestionPage() {
  return (
    <DashboardLayout 
      title="News Ingestion"
      description="Upload and manage news articles"
      backHref="/en"
    >
      <NewsIngestionTool />
    </DashboardLayout>
  );
}
