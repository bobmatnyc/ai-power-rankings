import { Suspense } from "react";
import NewsContent from "@/components/news/news-content";

export default function NewsPage(): React.JSX.Element {
  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading news...</p>
          </div>
        }
      >
        <NewsContent />
      </Suspense>
    </div>
  );
}