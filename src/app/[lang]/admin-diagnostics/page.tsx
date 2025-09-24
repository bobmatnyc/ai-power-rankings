import { currentUser } from '@clerk/nextjs/server';
import { DiagnosticsClient } from './diagnostics-client';

export default async function AdminDiagnosticsPage() {
  // Server-side authentication check
  const user = await currentUser();

  const serverDiagnostics = {
    authenticated: !!user,
    userId: user?.id || null,
    emailAddress: user?.emailAddresses?.[0]?.emailAddress || null,
    username: user?.username || null,
    firstName: user?.firstName || null,
    lastName: user?.lastName || null,
    createdAt: user?.createdAt || null,
    lastSignInAt: user?.lastSignInAt || null,
    hasImage: !!user?.imageUrl,
    publicMetadata: user?.publicMetadata || {},
    privateMetadata: user?.privateMetadata || {},
    unsafeMetadata: user?.unsafeMetadata || {},
  };

  // Server environment info
  const serverEnv = {
    nodeVersion: process.version,
    nextAuthUrl: process.env["NEXT_PUBLIC_CLERK_SIGN_IN_URL"] || 'not set',
    clerkPublishableKey: process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] ? 'set' : 'not set',
    clerkSecretKey: process.env["CLERK_SECRET_KEY"] ? 'set' : 'not set',
    nodeEnv: process.env["NODE_ENV"],
    vercelEnv: process.env["VERCEL_ENV"] || 'not set',
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Diagnostics</h1>

      {/* Server-side Authentication Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          Server-side Authentication Status
        </h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Status:</span>
            <span className={`px-2 py-1 rounded text-sm ${
              serverDiagnostics.authenticated
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {serverDiagnostics.authenticated ? 'Authenticated' : 'Not Authenticated'}
            </span>
          </div>

          {serverDiagnostics.authenticated && (
            <>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">User ID:</span> {serverDiagnostics.userId}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">Email:</span> {serverDiagnostics.emailAddress}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">Username:</span> {serverDiagnostics.username || 'N/A'}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">Name:</span> {serverDiagnostics.firstName} {serverDiagnostics.lastName}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">Created:</span> {serverDiagnostics.createdAt ? new Date(serverDiagnostics.createdAt).toLocaleString() : 'N/A'}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">Last Sign In:</span> {serverDiagnostics.lastSignInAt ? new Date(serverDiagnostics.lastSignInAt).toLocaleString() : 'N/A'}
              </div>

              {Object.keys(serverDiagnostics.publicMetadata).length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    Public Metadata
                  </summary>
                  <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(serverDiagnostics.publicMetadata, null, 2)}
                  </pre>
                </details>
              )}

              {Object.keys(serverDiagnostics.privateMetadata).length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    Private Metadata
                  </summary>
                  <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(serverDiagnostics.privateMetadata, null, 2)}
                  </pre>
                </details>
              )}

              {Object.keys(serverDiagnostics.unsafeMetadata).length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    Unsafe Metadata
                  </summary>
                  <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(serverDiagnostics.unsafeMetadata, null, 2)}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      </div>

      {/* Server Environment Info */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          Server Environment
        </h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-semibold">Node Version:</span> {serverEnv.nodeVersion}
          </div>
          <div>
            <span className="font-semibold">NODE_ENV:</span> {serverEnv.nodeEnv}
          </div>
          <div>
            <span className="font-semibold">VERCEL_ENV:</span> {serverEnv.vercelEnv}
          </div>
          <div>
            <span className="font-semibold">Clerk Sign-In URL:</span> {serverEnv.nextAuthUrl}
          </div>
          <div>
            <span className="font-semibold">Clerk Publishable Key:</span>{' '}
            <span className={`px-2 py-1 rounded text-xs ${
              serverEnv.clerkPublishableKey === 'set'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {serverEnv.clerkPublishableKey}
            </span>
          </div>
          <div>
            <span className="font-semibold">Clerk Secret Key:</span>{' '}
            <span className={`px-2 py-1 rounded text-xs ${
              serverEnv.clerkSecretKey === 'set'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {serverEnv.clerkSecretKey}
            </span>
          </div>
        </div>
      </div>

      {/* Client-side Diagnostics */}
      <DiagnosticsClient />
    </div>
  );
}