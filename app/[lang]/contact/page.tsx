import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export default async function ContactRedirect({ params }: PageProps) {
  const { lang } = await params;

  // Redirect to the dynamic contact form page to ensure proper Clerk handling.
  // #191 Q-A85-4: permanent (308), not the temporary redirect().
  permanentRedirect(`/${lang}/contact/default`);
}
