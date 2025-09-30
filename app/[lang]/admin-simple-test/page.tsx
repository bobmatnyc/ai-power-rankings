import { currentUser } from "@clerk/nextjs/server";
import { SimpleTestClient } from "./simple-client";

// Force dynamic rendering - this page requires authentication
export const dynamic = "force-dynamic";

export default async function AdminSimpleTestPage() {
  // Server-side authentication check
  const user = await currentUser();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Simple Admin Test Page</h1>

      {/* Authentication Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Authentication Status (Server-side)</h2>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Authenticated:</span>
            <span
              className={`px-2 py-1 rounded text-sm ${
                user ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {user ? "YES" : "NO"}
            </span>
          </div>

          {user && (
            <>
              <div className="text-sm">
                <span className="font-semibold">User ID:</span> {user.id}
              </div>
              <div className="text-sm">
                <span className="font-semibold">Email:</span>{" "}
                {user.emailAddresses?.[0]?.emailAddress}
              </div>
              <div className="text-sm">
                <span className="font-semibold">Name:</span> {user.firstName} {user.lastName}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Simple Client Component for Testing */}
      <SimpleTestClient />
    </div>
  );
}
