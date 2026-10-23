export default function NotFound() {
  return (
    <div
      className="bg-ds-surface-paper-muted"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        className="bg-ds-surface-paper"
        style={{
          borderRadius: "0.5rem",
          padding: "2rem",
          maxWidth: "28rem",
          width: "100%",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "4rem",
            fontWeight: "bold",
            marginBottom: "1rem",
            color: "#111827",
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: "600",
            marginBottom: "0.5rem",
            color: "#374151",
          }}
        >
          Page Not Found
        </h2>
        <p
          className="text-ds-text-paper-subtle"
          style={{
            marginBottom: "1.5rem",
          }}
        >
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {/* #190: hover/active variants hold the colour against globals.css a:hover and a:active. */}
          <a
            href="/"
            className="bg-ds-accent-cat-blue text-ds-text-on-fill hover:text-ds-text-on-fill active:text-ds-text-on-fill"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Return Home
          </a>
          <a
            href="/en"
            className="border-ds-border-paper bg-ds-surface-paper text-ds-accent-cat-blue hover:text-ds-accent-cat-blue active:text-ds-accent-cat-blue"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              borderWidth: "1px",
              borderStyle: "solid",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            View Rankings
          </a>
        </div>
      </div>
    </div>
  );
}
