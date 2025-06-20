"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Github, Mail, Shield } from "lucide-react";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Admin Login</h1>
          <p className="text-gray-600 mt-2">Sign in to access the admin dashboard</p>
        </div>

        <Card className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error === "OAuthAccountNotLinked"
                ? "This email is already associated with another provider."
                : error === "AccessDenied"
                ? "You are not authorized to access the admin area."
                : "An error occurred during sign in. Please try again."}
            </div>
          )}

          <div className="space-y-4">
            <Button
              onClick={() => signIn("github", { callbackUrl })}
              className="w-full"
              variant="outline"
              size="lg"
            >
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or</span>
              </div>
            </div>

            <Button
              onClick={() => signIn("google", { callbackUrl })}
              className="w-full"
              variant="outline"
              size="lg"
            >
              <Mail className="mr-2 h-5 w-5" />
              Continue with Google
            </Button>
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Only authorized administrators can access this area.</p>
            <p className="mt-2">
              If you believe you should have access, please contact the system administrator.
            </p>
          </div>
        </Card>

        <div className="mt-4 text-center text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">
            ← Back to main site
          </Link>
        </div>
      </div>
    </div>
  );
}