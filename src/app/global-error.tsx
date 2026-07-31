"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
          }}
        >
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <h1>Estate Brain konnte nicht geladen werden</h1>
            <p>
              Es wurden keine Daten verändert. Bitte versuche die Seite erneut
              zu laden.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ padding: "0.75rem 1rem", cursor: "pointer" }}
            >
              Erneut versuchen
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
