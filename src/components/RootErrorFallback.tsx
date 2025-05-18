"use client";

import type { FallbackProps } from "react-error-boundary";

export function RootErrorFallback({
  error,
  resetErrorBoundary,
}: FallbackProps) {
  // You can customize this further, log the error, etc.
  return (
    <div role="alert" className="p-4">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{typeof error === 'object' && error && 'message' in error ? (error as { message: string }).message : String(error)}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
