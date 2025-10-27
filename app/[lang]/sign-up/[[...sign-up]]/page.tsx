import { SignUp } from "@clerk/nextjs";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp
        routing="path"
        path={`/${lang}/sign-up`}
        signInUrl={`/${lang}/sign-in`}
        fallbackRedirectUrl={`/${lang}/admin`}
        forceRedirectUrl={undefined}
      />
    </div>
  );
}
