"use client";

import React from "react";

const BackToWebsiteNav: React.FC = () => {
  const websiteUrl =
    process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://aipowerranking.com";

  return (
    <div
      style={{
        padding: "1rem",
        borderBottom: "1px solid #e5e7eb",
        background: "#f0fdf4",
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
          background: "#22c55e",
          color: "white",
          textDecoration: "none",
          borderRadius: "6px",
          fontWeight: "500",
          fontSize: "0.875rem",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#16a34a";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#22c55e";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        🌐 Back to Website
      </a>
    </div>
  );
};

export default BackToWebsiteNav;
