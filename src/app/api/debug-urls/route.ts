import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/get-base-url";
import { headers } from "next/headers";

export async function GET() {
  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") || "https";

  return NextResponse.json({
    environment: {
      NODE_ENV: process.env["NODE_ENV"],
      VERCEL: process.env["VERCEL"],
      VERCEL_ENV: process.env["VERCEL_ENV"],
      VERCEL_URL: process.env["VERCEL_URL"],
      NEXT_PUBLIC_BASE_URL: process.env["NEXT_PUBLIC_BASE_URL"],
      NEXTAUTH_URL: process.env["NEXTAUTH_URL"],
    },
    computed: {
      baseUrl: getBaseUrl(),
      host: host,
      proto: proto,
      fullUrl: `${proto}://${host}`,
    },
    checks: {
      isProduction: process.env["NODE_ENV"] === "production",
      isVercel: !!process.env["VERCEL"],
      isPreview: process.env["VERCEL_ENV"] === "preview",
      hasCustomUrl: !!process.env["NEXT_PUBLIC_BASE_URL"],
    },
  });
}
