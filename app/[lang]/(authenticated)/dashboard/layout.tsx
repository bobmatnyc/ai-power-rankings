import type { ReactNode } from "react";
import { requireSignedInPage } from "@/lib/protected-page-guard";

interface DashboardTreeLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}

/** Server-side sign-in check for every dashboard page; see lib/protected-page-guard.ts. */
export default async function DashboardTreeLayout({ children, params }: DashboardTreeLayoutProps) {
  const { lang } = await params;
  await requireSignedInPage(lang, "dashboard");
  return <>{children}</>;
}
