import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export default async function DashboardSignIn({ params }: PageProps) {
  const { lang } = await params;

  // Redirect to Clerk sign-in page
  redirect(`/${lang}/sign-in`);
}
