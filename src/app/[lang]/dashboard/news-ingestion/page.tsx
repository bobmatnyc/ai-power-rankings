import { NewsIngestionTool } from "@/components/admin/news-ingestion-tool";

export default function NewsIngestionPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">News Ingestion</h1>
      <NewsIngestionTool />
    </div>
  );
}
