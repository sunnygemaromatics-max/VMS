'use client';

import { useEffect } from 'react';

/**
 * Route-segment error boundary. Replaces Next.js's bare
 * "Application error: a client-side exception has occurred" black
 * screen with a readable message + a working retry button.
 *
 * Without this file, any uncaught render error in a page renders
 * just that error string with no recovery path — terrible UX for
 * a demo.
 */
export default function GlobalSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to the console so devtools shows the stack.
    // eslint-disable-next-line no-console
    console.error('[page error]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-0 text-text-primary">
      <div className="max-w-lg w-full bg-surface-2 border border-border-subtle rounded-xl p-6 shadow-op-2">
        <h1 className="text-lg font-semibold text-text-primary">Something went wrong on this page.</h1>
        <p className="text-sm text-text-tertiary mt-1">
          The error has been logged. You can retry without leaving the app.
        </p>
        <pre className="mt-4 text-xs text-danger bg-surface-1 border border-border-subtle rounded-md p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
          {error?.message || 'Unknown error'}
          {error?.digest ? `\n\nref: ${error.digest}` : ''}
        </pre>
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium"
          >
            Try again
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="px-4 py-2 rounded-md bg-surface-3 hover:bg-surface-4 text-text-primary text-sm"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
