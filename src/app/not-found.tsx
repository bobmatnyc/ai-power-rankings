// Force static generation to avoid Html import issue
export const dynamic = 'force-static';

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f9fafb",
      padding: "1rem",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{
        backgroundColor: "white",
        borderRadius: "0.5rem",
        padding: "2rem",
        maxWidth: "28rem",
        width: "100%",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        textAlign: "center"
      }}>
        <h1 style={{
          fontSize: "4rem",
          fontWeight: "bold",
          marginBottom: "1rem",
          color: "#111827"
        }}>
          404
        </h1>
        <h2 style={{
          fontSize: "1.5rem",
          fontWeight: "600",
          marginBottom: "0.5rem",
          color: "#374151"
        }}>
          Page Not Found
        </h2>
        <p style={{
          marginBottom: "1.5rem",
          color: "#6b7280"
        }}>
          Sorry, we couldn't find the page you're looking for.
        </p>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem"
        }}>
          <a
            href="/"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#3b82f6",
              color: "white",
              borderRadius: "0.375rem",
              textDecoration: "none",
              display: "inline-block"
            }}
          >
            Return Home
          </a>
          <a
            href="/en"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "white",
              color: "#3b82f6",
              borderRadius: "0.375rem",
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              display: "inline-block"
            }}
          >
            View Rankings
          </a>
        </div>
      </div>
    </div>
  );
}