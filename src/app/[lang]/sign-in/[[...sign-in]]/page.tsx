import { SignIn } from "@clerk/nextjs";

// Force dynamic rendering to prevent Clerk SSG issues
export const dynamic = "force-dynamic";

interface SignInPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function SignInPage({ params }: SignInPageProps) {
  const { lang } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn
        routing="path"
        path={`/${lang}/sign-in`}
        signUpUrl={`/${lang}/sign-up`}
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
