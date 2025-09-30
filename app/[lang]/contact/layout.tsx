// CRITICAL: This layout DOES NOT have generateStaticParams
// This prevents the contact page from being statically generated
export const dynamic = "force-dynamic";

export default async function ContactLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  // Await params to satisfy Next.js 15 requirements
  await params;
  return <>{children}</>;
}
