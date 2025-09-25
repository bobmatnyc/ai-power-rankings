import type { Locale } from "@/i18n/config";

// CRITICAL: This layout DOES NOT have generateStaticParams
// This prevents the contact page from being statically generated
export const dynamic = "force-dynamic";

interface ContactLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}

export default function ContactLayout({ children }: ContactLayoutProps) {
  return <>{children}</>;
}
