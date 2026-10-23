import type { ReactNode } from "react";
import { requireSignedInPage } from "@/lib/protected-page-guard";

interface AdminTreeLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}

/** Server-side sign-in check for every admin page; see lib/protected-page-guard.ts. */
export default async function AdminTreeLayout({ children, params }: AdminTreeLayoutProps) {
  const { lang } = await params;
  await requireSignedInPage(lang, "admin");
  return <>{children}</>;
}
