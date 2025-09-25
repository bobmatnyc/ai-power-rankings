import { currentUser } from '@clerk/nextjs/server';
import { BasicTestButton } from './basic-client';

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic';

export default async function AdminBasicTestPage() {
  const user = await currentUser();

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Basic Admin Test</h1>

      <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h2>Server Authentication Status</h2>
        <p>User Authenticated: <strong>{user ? 'YES' : 'NO'}</strong></p>
        {user && (
          <div>
            <p>User ID: {user.id}</p>
            <p>Email: {user.emailAddresses?.[0]?.emailAddress}</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h2>Quick API Test</h2>
        <p>Click the button below to test /api/admin/db-status endpoint.</p>
        <p>Open browser console (F12) to see the results.</p>

        <BasicTestButton />
      </div>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <h3>Instructions:</h3>
        <ol>
          <li>Open browser DevTools (F12)</li>
          <li>Go to Console tab</li>
          <li>Click "Test API" button</li>
          <li>Watch console for detailed output</li>
        </ol>
      </div>
    </div>
  );
}