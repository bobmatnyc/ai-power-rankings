'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('[ErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Error details:', {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
    });
  }

  resetError = () => {
    console.log('[ErrorBoundary] Resetting error state');
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      const { fallback: FallbackComponent } = this.props;

      if (FallbackComponent && this.state.error) {
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <div className="bg-red-50 border border-red-200 rounded-lg shadow-md p-6 m-4">
          <h2 className="text-xl font-bold text-red-800 mb-4">
            Something went wrong
          </h2>
          <div className="space-y-3">
            <div className="text-sm text-red-700">
              <strong>Error:</strong> {this.state.error?.message || 'Unknown error'}
            </div>
            {this.state.error?.stack && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-red-700">
                  Stack Trace
                </summary>
                <pre className="mt-2 text-xs bg-white p-3 rounded overflow-x-auto text-gray-700">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={this.resetError}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Reset and Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error fallback component for specific sections
export function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-yellow-800 mb-2">
        Component Error
      </h3>
      <p className="text-sm text-yellow-700 mb-3">
        This component failed to load properly.
      </p>
      <div className="text-xs text-gray-600 bg-white p-2 rounded mb-3">
        {error.message}
      </div>
      <button
        onClick={resetError}
        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
      >
        Try Again
      </button>
    </div>
  );
}