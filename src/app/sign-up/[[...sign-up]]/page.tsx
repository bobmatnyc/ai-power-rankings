import { SignUp } from "@clerk/nextjs";

// Force dynamic rendering to prevent Clerk SSG issues
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
