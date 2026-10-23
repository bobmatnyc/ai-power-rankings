"use client";

import type React from "react";

const BackToWebsiteNav: React.FC = () => {
  const websiteUrl =
    process.env["NODE_ENV"] === "development"
      ? "http://localhost:3000"
      : "https://aipowerranking.com";

  return (
    <div
      style={{
        padding: "1rem",
        borderBottom: "1px solid hsl(var(--ds-border-paper))",
        background: "hsl(var(--ds-success-fixed-subtle))",
      }}
    >
      <a
        href={websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.75rem 1rem",
          background: "hsl(var(--ds-success-solid))",
          color: "white",
          textDecoration: "none",
          borderRadius: "6px",
          fontWeight: "500",
          fontSize: "0.875rem",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "hsl(var(--ds-success-fixed-mid))";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "hsl(var(--ds-success-solid))";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        🌐 Back to Website
      </a>
    </div>
  );
};

export default BackToWebsiteNav;
