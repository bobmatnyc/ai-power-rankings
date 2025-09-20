import { SignIn } from "@clerk/nextjs";

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
