'use client';

export function NoAuthHeader() {
  return (
    <header className="flex justify-end items-center p-4 gap-4 h-16 border-b">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>🔓 Development Mode (Auth Disabled)</span>
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-md">
          <span>dev@localhost</span>
        </div>
      </div>
    </header>
  );
}