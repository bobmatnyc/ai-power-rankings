import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title") || "AI Power Rankings";
    const subtitle = searchParams.get("subtitle") || "Developer Tool Intelligence";
    const rank = searchParams.get("rank");
    const logo = searchParams.get("logo");
    const description = searchParams.get("description");

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            backgroundColor: "#1e293b",
            backgroundImage: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
            padding: "80px",
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          }}
        >
          {/* Top section with logo/rank */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "40px", gap: "24px" }}>
            {logo && (
              <img
                src={logo}
                alt="Tool logo"
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "12px",
                  objectFit: "cover",
                  backgroundColor: "white",
                }}
              />
            )}
            {rank && (
              <div
                style={{
                  backgroundColor: "#3b82f6",
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: "24px",
                  fontSize: "32px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                #{rank}
              </div>
            )}
          </div>

          {/* Main title */}
          <div
            style={{
              fontSize: "72px",
              fontWeight: "bold",
              color: "white",
              lineHeight: "1.1",
              marginBottom: "24px",
              maxWidth: "900px",
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: "36px",
              color: "#94a3b8",
              marginBottom: description ? "24px" : "60px",
              fontWeight: "400",
            }}
          >
            {subtitle}
          </div>

          {/* Description */}
          {description && (
            <div
              style={{
                fontSize: "24px",
                color: "#cbd5e1",
                marginBottom: "60px",
                fontWeight: "400",
                maxWidth: "900px",
                lineHeight: "1.4",
              }}
            >
              {description}
            </div>
          )}

          {/* Branding footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "#64748b",
              fontSize: "28px",
              fontWeight: "500",
              marginTop: "auto",
            }}
          >
            <div
              style={{
                marginRight: "16px",
                fontSize: "36px",
              }}
            >
              📊
            </div>
            AI Power Rankings
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error("OG Image generation error:", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
