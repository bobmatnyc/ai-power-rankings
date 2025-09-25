import { redirect } from "next/navigation";

// Force dynamic rendering - this page may use authentication context
export const dynamic = 'force-dynamic';


interface PageProps {
  params: Promise<{ lang: string }>;
}

export default async function AdminSignIn({ params }: PageProps) {
  const { lang } = await params;

  // Redirect to Clerk sign-in page
  redirect(`/${lang}/sign-in`);
}
