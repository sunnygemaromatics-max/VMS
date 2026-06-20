'use client';

import { useEffect } from 'react';

/**
 * Last-line-of-defence boundary — catches errors that originate in the
 * root layout itself (Providers, etc). Must render its own <html> + <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: '#060814', color: '#F3F5FA', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 560, width: '100%', background: '#11162A', border: '1px solid #1F2641', borderRadius: 12, padding: 24 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>The application hit a fatal error.</h1>
            <p style={{ color: '#9AA3B8', fontSize: 13, marginTop: 6 }}>
              This is the root-layout fallback. Refresh the page to retry.
            </p>
            <pre style={{ marginTop: 16, fontSize: 12, background: '#0B0F1F', border: '1px solid #1F2641', borderRadius: 8, padding: 12, color: '#FCA5A5', overflow: 'auto', maxHeight: 192, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {error?.message || 'Unknown error'}
              {error?.digest ? `\n\nref: ${error.digest}` : ''}
            </pre>
            <button
              onClick={reset}
              style={{ marginTop: 16, padding: '8px 16px', borderRadius: 6, background: '#7C3AED', color: '#fff', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
