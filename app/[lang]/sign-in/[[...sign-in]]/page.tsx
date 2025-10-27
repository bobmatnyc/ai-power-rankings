import { SignIn } from "@clerk/nextjs";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn
        routing="path"
        path={`/${lang}/sign-in`}
        signUpUrl={`/${lang}/sign-up`}
        fallbackRedirectUrl={`/${lang}/admin`}
        forceRedirectUrl={undefined}
      />
    </div>
  );
}
