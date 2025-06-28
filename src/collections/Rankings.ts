import type { CollectionConfig } from "payload";

export const Rankings: CollectionConfig = {
  slug: "rankings",
  admin: {
    useAsTitle: "period",
    defaultColumns: ["period", "tool_display", "position", "score", "movement"],
    group: "Rankings",
    listSearchableFields: ["period", "tool.name"],
    pagination: {
      defaultLimit: 25,
    },
  },
  defaultSort: "position",
  defaultPopulate: {
    tool: {
      name: true,
      slug: true,
      category: true,
    },
  },
  fields: [
    {
      name: "period",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "e.g., 2025-W06 for week 6 of 2025",
      },
    },
    {
      name: "tool",
      type: "relationship",
      relationTo: "tools",
      required: true,
      index: true,
      admin: {
        allowCreate: false,
      },
      filterOptions: {
        status: {
          equals: "active",
        },
      },
    },
    {
      name: "tool_display",
      type: "text",
      admin: {
        readOnly: true,
        description: "Tool name for display (auto-populated)",
      },
      hooks: {
        beforeChange: [
          async ({ data, req }) => {
            if (data?.['tool']) {
              try {
                // Get the tool document to populate the name
                const toolId = typeof data['tool'] === "string" ? data['tool'] : data['tool']['id'];
                const tool = await req.payload.findByID({
                  collection: "tools",
                  id: toolId,
                });
                return tool?.['name'] || "Unknown Tool";
              } catch (error) {
                console.error("Error fetching tool name:", error);
                return "Error Loading Tool";
              }
            }
            return "No Tool Selected";
          },
        ],
        afterRead: [
          async ({ data, req }) => {
            if (data?.['tool']) {
              try {
                // Handle both populated and unpopulated tool references
                if (typeof data['tool'] === "object" && data['tool']['name']) {
                  data['tool_display'] = data['tool']['name'];
                  return data['tool_display'];
                }

                const toolId = typeof data['tool'] === "string" ? data['tool'] : data['tool']['id'];
                if (toolId) {
                  const tool = await req.payload.findByID({
                    collection: "tools",
                    id: toolId,
                  });
                  data['tool_display'] = tool?.['name'] || "Unknown Tool";
                  return data['tool_display'];
                }
              } catch (error) {
                console.error("Error fetching tool name:", error);
                data['tool_display'] = "Error Loading Tool";
                return data['tool_display'];
              }
            }
            if (data) {
              data['tool_display'] = "No Tool Selected";
              return data['tool_display'];
            }
            return "No Tool Selected";
          },
        ],
      },
    },
    {
      name: "position",
      type: "number",
      required: true,
      min: 1,
      index: true,
    },
    {
      name: "score",
      type: "number",
      required: true,
      admin: {
        description: "Overall composite score",
      },
    },
    {
      name: "market_traction_score",
      type: "number",
      admin: {
        description: "25% weight - GitHub stars, downloads, revenue, funding",
      },
    },
    {
      name: "technical_capability_score",
      type: "number",
      admin: {
        description: "25% weight - Agentic capabilities, integration, features",
      },
    },
    {
      name: "developer_adoption_score",
      type: "number",
      admin: {
        description: "20% weight - Sentiment, community, user growth",
      },
    },
    {
      name: "development_velocity_score",
      type: "number",
      admin: {
        description: "15% weight - GitHub activity, release frequency",
      },
    },
    {
      name: "platform_resilience_score",
      type: "number",
      admin: {
        description: "10% weight - Financial stability, business model",
      },
    },
    {
      name: "community_sentiment_score",
      type: "number",
      admin: {
        description: "5% weight - Reviews, sentiment analysis",
      },
    },
    {
      name: "previous_position",
      type: "number",
      admin: {
        description: "Position in the previous period",
      },
    },
    {
      name: "movement",
      type: "select",
      options: [
        { label: "Up", value: "up" },
        { label: "Down", value: "down" },
        { label: "Same", value: "same" },
        { label: "New Entry", value: "new" },
        { label: "Returning", value: "returning" },
        { label: "Dropped Out", value: "dropped" },
      ],
      admin: {
        description: "Movement direction from previous period",
      },
    },
    {
      name: "movement_positions",
      type: "number",
      admin: {
        description: "Number of positions moved (positive = up, negative = down)",
      },
      hooks: {
        beforeChange: [
          ({ data }) => {
            if (data?.["position"] && data?.["previous_position"]) {
              return data["previous_position"] - data["position"];
            }
            return 0;
          },
        ],
      },
    },
    {
      name: "algorithm_version",
      type: "text",
      defaultValue: "v6.0",
      admin: {
        description: "Version of the ranking algorithm used",
      },
    },
    {
      name: "data_completeness",
      type: "number",
      min: 0,
      max: 1,
      admin: {
        description: "Percentage of data points available (0-1)",
      },
    },
    {
      name: "is_current",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "Whether this ranking period is the current/live one",
      },
      index: true,
    },
    // Factor scores (v6 algorithm)
    {
      name: "agentic_capability",
      type: "number",
      admin: {
        description: "Agentic capability score (0-10)",
      },
    },
    {
      name: "innovation",
      type: "number",
      admin: {
        description: "Innovation score (0-10)",
      },
    },
    {
      name: "technical_performance",
      type: "number",
      admin: {
        description: "Technical performance score (0-10)",
      },
    },
    {
      name: "developer_adoption",
      type: "number",
      admin: {
        description: "Developer adoption score (0-10)",
      },
    },
    {
      name: "market_traction",
      type: "number",
      admin: {
        description: "Market traction score (0-10)",
      },
    },
    {
      name: "business_sentiment",
      type: "number",
      admin: {
        description: "Business sentiment score (0-10)",
      },
    },
    {
      name: "development_velocity",
      type: "number",
      admin: {
        description: "Development velocity score (0-10)",
      },
    },
    {
      name: "platform_resilience",
      type: "number",
      admin: {
        description: "Platform resilience score (0-10)",
      },
    },
    // Additional metadata
    {
      name: "tool_id",
      type: "text",
      admin: {
        description: "Tool ID for reference",
      },
    },
    {
      name: "tool_name",
      type: "text",
      admin: {
        description: "Tool name for reference",
      },
    },
    {
      name: "position_change",
      type: "number",
      admin: {
        description: "Change in position from previous period",
      },
    },
    {
      name: "score_change",
      type: "number",
      admin: {
        description: "Change in score from previous period",
      },
    },
    {
      name: "tier",
      type: "text",
      admin: {
        description: "Tier classification (S, A, B, C, D)",
      },
    },
    {
      name: "preview_date",
      type: "text",
      admin: {
        description: "Date used for preview calculation",
      },
    },
    {
      name: "primary_reason",
      type: "text",
      admin: {
        description: "Primary reason for ranking change",
      },
    },
    {
      name: "narrative_explanation",
      type: "textarea",
      admin: {
        description: "Detailed explanation of ranking position",
      },
    },
  ],
  timestamps: true,
  indexes: [
    {
      fields: ["period", "position"],
      unique: true,
    },
    {
      fields: ["tool", "period"],
      unique: true,
    },
  ],
};
