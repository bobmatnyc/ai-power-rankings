import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

interface ToolOGParams {
  name: string;
  category: string;
  rank?: string;
  score?: string;
  logo?: string;
  company?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const toolData: ToolOGParams = {
      name: searchParams.get("name") || "AI Tool",
      category: searchParams.get("category") || "AI Assistant",
      rank: searchParams.get("rank") || undefined,
      score: searchParams.get("score") || undefined,
      logo: searchParams.get("logo") || undefined,
      company: searchParams.get("company") || undefined,
    };

    // Category color mapping
    const getCategoryColor = (category: string): string => {
      const colors: Record<string, string> = {
        "code-assistant": "#3b82f6", // blue
        "image-generation": "#10b981", // emerald
        "text-generation": "#8b5cf6", // violet
        "data-analysis": "#f59e0b", // amber
        automation: "#ef4444", // red
        chatbot: "#06b6d4", // cyan
        search: "#84cc16", // lime
        productivity: "#ec4899", // pink
      };
      return colors[category] || "#6366f1"; // default indigo
    };

    const categoryColor = getCategoryColor(toolData.category);

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0f172a", // slate-900
          backgroundImage: `
              radial-gradient(600px circle at 0px 0px, ${categoryColor}15, transparent),
              radial-gradient(600px circle at 100% 100%, ${categoryColor}10, transparent)
            `,
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Header with category and rank */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "40px 60px 0 60px",
          }}
        >
          {/* Category badge */}
          <div
            style={{
              backgroundColor: categoryColor,
              color: "white",
              padding: "12px 24px",
              borderRadius: "24px",
              fontSize: "24px",
              fontWeight: "600",
              textTransform: "capitalize",
            }}
          >
            {toolData.category.replace(/-/g, " ")}
          </div>

          {/* Rank badge */}
          {toolData.rank && (
            <div
              style={{
                backgroundColor: "#1e293b", // slate-800
                border: `2px solid ${categoryColor}`,
                color: "white",
                padding: "16px 32px",
                borderRadius: "32px",
                fontSize: "32px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Rank #{toolData.rank}
            </div>
          )}
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            padding: "40px 60px",
            gap: "48px",
          }}
        >
          {/* Tool logo */}
          {toolData.logo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "160px",
                height: "160px",
                borderRadius: "24px",
                backgroundColor: "white",
                border: `4px solid ${categoryColor}`,
                boxShadow: `0 25px 50px -12px ${categoryColor}40`,
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: OG images require <img> for server-side rendering */}
              <img
                src={toolData.logo}
                alt={`${toolData.name} logo`}
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "16px",
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          {/* Tool info */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            {/* Tool name */}
            <div
              style={{
                fontSize: "64px",
                fontWeight: "800",
                color: "white",
                lineHeight: "1.1",
                marginBottom: "16px",
                letterSpacing: "-0.02em",
              }}
            >
              {toolData.name}
            </div>

            {/* Company name */}
            {toolData.company && (
              <div
                style={{
                  fontSize: "28px",
                  color: "#94a3b8", // slate-400
                  marginBottom: "24px",
                  fontWeight: "500",
                }}
              >
                by {toolData.company}
              </div>
            )}

            {/* Score display */}
            {toolData.score && (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    fontSize: "24px",
                    color: "#e2e8f0", // slate-200
                    fontWeight: "600",
                  }}
                >
                  Overall Score:
                </div>
                <div
                  style={{
                    backgroundColor: categoryColor,
                    color: "white",
                    padding: "8px 20px",
                    borderRadius: "20px",
                    fontSize: "28px",
                    fontWeight: "bold",
                  }}
                >
                  {toolData.score}/100
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 60px 40px 60px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "#64748b", // slate-500
              fontSize: "24px",
              fontWeight: "600",
            }}
          >
            <div style={{ marginRight: "12px", fontSize: "32px" }}>📊</div>
            AI Power Rankings
          </div>

          {/* Decorative gradient line */}
          <div
            style={{
              width: "200px",
              height: "4px",
              background: `linear-gradient(90deg, transparent, ${categoryColor}, transparent)`,
              borderRadius: "2px",
            }}
          />
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error("Tool OG Image generation error:", e);
    return new Response("Failed to generate tool image", { status: 500 });
  }
}
