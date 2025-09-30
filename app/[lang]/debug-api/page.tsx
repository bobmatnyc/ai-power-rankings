// Force dynamic rendering to avoid Clerk SSG issues
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DebugApiPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug API Page</h1>
      <p className="mb-4">
        This page is temporarily disabled during production builds to avoid build issues.
      </p>
      <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
        <p>
          <strong>Note:</strong> This debug page will be fully functional in development mode.
        </p>
      </div>
    </div>
  );
}
