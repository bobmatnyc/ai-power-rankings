"use client";

export function NoAuthHeader() {
  return (
    <header className="flex justify-end items-center p-4 gap-4 h-16 border-b">
      <div className="flex items-center gap-2 text-sm text-ds-text-paper-muted">
        <span>🔓 Development Mode (Auth Disabled)</span>
        <div className="flex items-center gap-2 px-3 py-1 bg-ds-surface-paper-sunken rounded-md">
          <span>dev@localhost</span>
        </div>
      </div>
    </header>
  );
}
