"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h1>Something went wrong</h1>
        <button type="button" onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
