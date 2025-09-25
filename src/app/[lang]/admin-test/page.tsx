import { currentUser } from "@clerk/nextjs/server";

export default async function AdminTestPage() {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;

  // Also test database access
  let articlesCount = 0;
  let dbError = null;

  if (isAdmin) {
    try {
      const { ArticlesRepository } = await import("@/lib/db/repositories/articles.repository");
      const repo = new ArticlesRepository();
      const articles = await repo.getArticles({ limit: 100 });
      articlesCount = articles.length;
    } catch (error) {
      dbError = error instanceof Error ? error.message : "Unknown error";
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Access Test Page</h1>

        {/* Authentication Status */}
        <div className="bg-white rounded-lg p-6 shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          {user ? (
            <div className="space-y-2">
              <p className="text-green-600 font-semibold">✅ You are signed in</p>
              <div className="bg-gray-50 p-4 rounded">
                <p><strong>Email:</strong> {user.emailAddresses[0]?.emailAddress}</p>
                <p><strong>User ID:</strong> {user.id}</p>
                <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
              </div>
            </div>
          ) : (
            <p className="text-red-600 font-semibold">❌ You are NOT signed in</p>
          )}
        </div>

        {/* Admin Status */}
        <div className="bg-white rounded-lg p-6 shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Admin Access Status</h2>
          {user ? (
            <div className="space-y-4">
              <div className={`p-4 rounded ${isAdmin ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`font-bold text-lg ${isAdmin ? 'text-green-700' : 'text-red-700'}`}>
                  {isAdmin ? '✅ You have ADMIN access!' : '❌ You do NOT have admin access'}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <p className="font-semibold mb-2">Public Metadata:</p>
                <pre className="text-sm bg-white p-2 rounded border">
                  {JSON.stringify(user.publicMetadata, null, 2)}
                </pre>
              </div>

              <div className="text-sm">
                <p><strong>isAdmin check:</strong> {String(user.publicMetadata?.isAdmin === true)}</p>
                <p><strong>Raw isAdmin value:</strong> {String(user.publicMetadata?.isAdmin)}</p>
                <p><strong>Type of isAdmin:</strong> {typeof user.publicMetadata?.isAdmin}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Sign in to check admin status</p>
          )}
        </div>

        {/* Database Access Test */}
        {isAdmin && (
          <div className="bg-white rounded-lg p-6 shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Database Access Test</h2>
            {dbError ? (
              <div className="bg-red-50 p-4 rounded">
                <p className="text-red-700">❌ Database Error: {dbError}</p>
              </div>
            ) : (
              <div className="bg-green-50 p-4 rounded">
                <p className="text-green-700">✅ Successfully accessed database</p>
                <p className="text-green-700">📊 Found {articlesCount} articles</p>
              </div>
            )}
          </div>
        )}

        {/* API Test Instructions */}
        <div className="bg-white rounded-lg p-6 shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">API Test Commands</h2>
          <p className="mb-4">Open a new tab and visit these URLs directly:</p>
          <div className="space-y-2">
            <div className="bg-gray-50 p-3 rounded">
              <p className="font-mono text-sm">
                <a href="/api/auth-verify" target="_blank" className="text-blue-600 hover:underline" rel="noopener">
                  /api/auth-verify
                </a>
                {" - Check your authentication status"}
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="font-mono text-sm">
                <a href="/api/admin/articles" target="_blank" className="text-blue-600 hover:underline" rel="noopener">
                  /api/admin/articles
                </a>
                {" - Test admin articles access"}
              </p>
            </div>
          </div>
        </div>

        {/* Admin Panel Link */}
        {isAdmin && (
          <div className="bg-blue-50 rounded-lg p-6 shadow">
            <h2 className="text-xl font-semibold mb-4">Ready to Access Admin Panel</h2>
            <p className="mb-4">Everything looks good! You should be able to access the admin panel now:</p>
            <a
              href="/admin"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition"
            >
              Go to Admin Panel →
            </a>
          </div>
        )}

        {/* Troubleshooting */}
        {user && !isAdmin && (
          <div className="bg-yellow-50 rounded-lg p-6 shadow">
            <h2 className="text-xl font-semibold mb-4">⚠️ How to Enable Admin Access</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to your Clerk Dashboard</li>
              <li>Navigate to Users → Find your user (bob@matsuoka.com)</li>
              <li>Click Edit → Public Metadata</li>
              <li>Set the value to: <code className="bg-white px-2 py-1 rounded">{`{"isAdmin": true}`}</code></li>
              <li>Save the changes</li>
              <li>Sign out and sign back in</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}