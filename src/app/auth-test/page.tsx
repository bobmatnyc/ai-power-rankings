import { currentUser } from "@clerk/nextjs/server";

export default async function AuthTestPage() {
  const user = await currentUser();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication Status Test</h1>

        <div className="bg-white rounded-lg p-6 shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Current User Status</h2>

          {user ? (
            <div className="space-y-2">
              <p className="text-green-600 font-semibold">✅ You are signed in</p>
              <div className="bg-gray-50 p-4 rounded">
                <p><strong>User ID:</strong> {user.id}</p>
                <p><strong>Email:</strong> {user.emailAddresses[0]?.emailAddress}</p>
                <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
              </div>
            </div>
          ) : (
            <p className="text-red-600 font-semibold">❌ You are NOT signed in</p>
          )}
        </div>

        <div className="bg-white rounded-lg p-6 shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Admin Status</h2>

          {user ? (
            <div className="space-y-2">
              <p>
                <strong>isAdmin in publicMetadata:</strong>{" "}
                <span className={user.publicMetadata?.isAdmin === true ? "text-green-600" : "text-red-600"}>
                  {String(user.publicMetadata?.isAdmin === true)}
                </span>
              </p>
              <div className="bg-gray-50 p-4 rounded">
                <p className="font-semibold mb-2">Public Metadata:</p>
                <pre className="text-sm">{JSON.stringify(user.publicMetadata, null, 2)}</pre>
              </div>
              {user.publicMetadata?.isAdmin === true ? (
                <p className="text-green-600 font-semibold">✅ You have admin access</p>
              ) : (
                <div className="text-red-600">
                  <p className="font-semibold">❌ You do NOT have admin access</p>
                  <p className="text-sm mt-2">
                    To fix: Go to Clerk Dashboard → Users → Your User → Edit → Public Metadata → Add: {"{ \"isAdmin\": true }"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Sign in first to check admin status</p>
          )}
        </div>

        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">Environment Check</h2>
          <div className="space-y-2">
            <p>
              <strong>NEXT_PUBLIC_DISABLE_AUTH:</strong>{" "}
              <span className={process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true" ? "text-red-600" : "text-green-600"}>
                {process.env["NEXT_PUBLIC_DISABLE_AUTH"] || "not set (good)"}
              </span>
            </p>
            <p>
              <strong>NODE_ENV:</strong> {process.env.NODE_ENV}
            </p>
            <p>
              <strong>Clerk Publishable Key:</strong>{" "}
              {process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] ? "✅ Set" : "❌ Not set"}
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold mb-2">Next Steps:</h3>
          {!user ? (
            <div>
              <p>1. <a href="/sign-in" className="text-blue-600 underline">Sign in here</a></p>
              <p>2. Come back to this page to check your status</p>
            </div>
          ) : user.publicMetadata?.isAdmin !== true ? (
            <div>
              <p>1. Your user needs admin access</p>
              <p>2. Go to Clerk Dashboard and add isAdmin: true to your public metadata</p>
              <p>3. Sign out and sign in again</p>
            </div>
          ) : (
            <div>
              <p className="text-green-600">✅ Everything looks good!</p>
              <p>Try accessing the <a href="/admin" className="text-blue-600 underline">admin panel</a></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}