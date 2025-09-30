import type { Locale } from "@/i18n/config";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export const dynamic = "force-dynamic";

export default async function TestPage({ params }: PageProps): Promise<React.JSX.Element> {
  try {
    const resolvedParams = await params;
    const lang = (resolvedParams?.lang || "en") as Locale;

    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-4">Test Page - Debugging SSR</h1>
        <p className="mb-2">Language: {lang}</p>
        <p className="mb-2">Environment: {process.env["NODE_ENV"]}</p>
        <p className="mb-2">Vercel URL: {process.env["VERCEL_URL"] || "Not set"}</p>
        <p className="mb-2">Base URL: {process.env["NEXT_PUBLIC_BASE_URL"] || "Not set"}</p>
        <p className="mb-2">Timestamp: {new Date().toISOString()}</p>
        <div className="mt-8 p-4 bg-green-100 rounded">
          <p className="text-green-800">✓ If you see this, SSR is working!</p>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Error in Test Page</h1>
        <pre className="bg-red-100 p-4 rounded text-red-800">
          {error instanceof Error ? error.message : JSON.stringify(error)}
        </pre>
      </div>
    );
  }
}
