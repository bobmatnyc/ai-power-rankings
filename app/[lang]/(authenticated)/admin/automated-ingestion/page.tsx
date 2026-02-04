// Force dynamic rendering to avoid Clerk SSG issues
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import AutomatedIngestionClient from "./automated-ingestion-client";

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

export default function AutomatedIngestionPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AutomatedIngestionClient />
    </Suspense>
  );
}
