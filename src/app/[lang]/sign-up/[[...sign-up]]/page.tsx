import { SignUp } from "@clerk/nextjs";

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
