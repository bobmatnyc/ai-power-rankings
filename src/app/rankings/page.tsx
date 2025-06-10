import { Suspense } from "react";
import RankingsGrid from "@/components/ranking/rankings-grid";

export default function RankingsPage(): React.JSX.Element {
  return (
    <div className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading rankings...</p>
          </div>
        }
      >
        <RankingsGrid />
      </Suspense>
    </div>
  );
}
