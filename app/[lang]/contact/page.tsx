import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export default async function ContactRedirect({ params }: PageProps) {
  const { lang } = await params;

  // Redirect to the dynamic contact form page to ensure proper Clerk handling
  redirect(`/${lang}/contact/default`);
}
