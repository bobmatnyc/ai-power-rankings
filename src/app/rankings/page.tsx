import { Suspense } from "react";
import RankingsContent from "@/components/ranking/rankings-content";

export default function RankingsPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-8">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading rankings...</p>
          </div>
        </div>
      }
    >
      <RankingsContent />
    </Suspense>
  );
}
