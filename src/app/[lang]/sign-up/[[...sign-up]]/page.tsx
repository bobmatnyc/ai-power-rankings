import { SignUp } from "@/components/auth/auth-components-simple";

// Force dynamic rendering to prevent Clerk SSG issues
export const dynamic = "force-dynamic";

interface SignUpPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function SignUpPage({ params }: SignUpPageProps) {
  const { lang } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp
        routing="path"
        path={`/${lang}/sign-up`}
        signInUrl={`/${lang}/sign-in`}
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}
