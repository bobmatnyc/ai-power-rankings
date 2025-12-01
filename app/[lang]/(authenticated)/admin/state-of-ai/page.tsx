// Force dynamic rendering to avoid Clerk SSG issues
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import StateOfAiClient from "./state-of-ai-client";

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

export default function StateOfAiPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <StateOfAiClient />
    </Suspense>
  );
}
