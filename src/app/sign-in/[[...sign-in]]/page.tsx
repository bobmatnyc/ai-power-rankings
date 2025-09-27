import { SignIn } from "@/components/auth/auth-components-simple";

// Force dynamic rendering to prevent Clerk SSG issues
export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
