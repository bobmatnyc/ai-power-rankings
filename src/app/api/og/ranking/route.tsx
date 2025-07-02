import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

interface RankingOGParams {
  title: string;
  period?: string;
  topTools?: string[];
  totalTools?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const rankingData: RankingOGParams = {
      title: searchParams.get("title") || "AI Tool Rankings",
      period: searchParams.get("period") || undefined,
      topTools: searchParams.get("topTools")?.split(",") || undefined,
      totalTools: searchParams.get("totalTools") || undefined,
    };

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#0f172a", // slate-900
            backgroundImage: `
              radial-gradient(800px circle at 20% 20%, #1e40af20, transparent),
              radial-gradient(600px circle at 80% 80%, #7c3aed15, transparent),
              radial-gradient(400px circle at 40% 90%, #059669010, transparent)
            `,
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
            padding: "60px",
          }}
        >
          {/* Header with period */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "40px",
            }}
          >
            {/* Period badge */}
            {rankingData.period && (
              <div
                style={{
                  backgroundColor: "#1e40af", // blue-800
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: "24px",
                  fontSize: "24px",
                  fontWeight: "600",
                }}
              >
                {rankingData.period}
              </div>
            )}

            {/* Total tools count */}
            {rankingData.totalTools && (
              <div
                style={{
                  color: "#94a3b8", // slate-400
                  fontSize: "24px",
                  fontWeight: "600",
                }}
              >
                {rankingData.totalTools} Tools Ranked
              </div>
            )}
          </div>

          {/* Main title */}
          <div
            style={{
              fontSize: "72px",
              fontWeight: "800",
              color: "white",
              lineHeight: "1.1",
              marginBottom: "48px",
              letterSpacing: "-0.02em",
            }}
          >
            {rankingData.title}
          </div>

          {/* Top tools preview */}
          {rankingData.topTools && rankingData.topTools.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                marginBottom: "48px",
              }}
            >
              <div
                style={{
                  fontSize: "32px",
                  color: "#e2e8f0", // slate-200
                  fontWeight: "600",
                  marginBottom: "16px",
                }}
              >
                Top Rankings:
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {rankingData.topTools.slice(0, 3).map((tool, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "20px",
                      backgroundColor: "#1e293b40", // slate-800 with opacity
                      padding: "16px 24px",
                      borderRadius: "16px",
                      border: "1px solid #334155", // slate-700
                    }}
                  >
                    {/* Rank number */}
                    <div
                      style={{
                        backgroundColor:
                          index === 0 ? "#f59e0b" : index === 1 ? "#6b7280" : "#cd7c0e", // gold, silver, bronze
                        color: "white",
                        width: "48px",
                        height: "48px",
                        borderRadius: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                        fontWeight: "bold",
                      }}
                    >
                      {index + 1}
                    </div>

                    {/* Tool name */}
                    <div
                      style={{
                        fontSize: "28px",
                        color: "white",
                        fontWeight: "600",
                      }}
                    >
                      {tool}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer branding */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#64748b", // slate-500
                fontSize: "28px",
                fontWeight: "600",
              }}
            >
              <div style={{ marginRight: "16px", fontSize: "36px" }}>🏆</div>
              AI Power Rankings
            </div>

            {/* Algorithm version */}
            <div
              style={{
                backgroundColor: "#374151", // gray-700
                color: "#d1d5db", // gray-300
                padding: "8px 16px",
                borderRadius: "12px",
                fontSize: "20px",
                fontWeight: "500",
              }}
            >
              Algorithm v6.0
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error("Ranking OG Image generation error:", e);
    return new Response("Failed to generate ranking image", { status: 500 });
  }
}
