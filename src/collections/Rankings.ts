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
    defaultSort: "-position",
  },
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
            if (data?.tool) {
              try {
                // Get the tool document to populate the name
                const toolId = typeof data.tool === "string" ? data.tool : data.tool.id;
                const tool = await req.payload.findByID({
                  collection: "tools",
                  id: toolId,
                });
                return tool?.name || "Unknown Tool";
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
            if (data?.tool) {
              try {
                // Handle both populated and unpopulated tool references
                if (typeof data.tool === "object" && data.tool.name) {
                  return data.tool.name;
                }

                const toolId = typeof data.tool === "string" ? data.tool : data.tool.id;
                if (toolId) {
                  const tool = await req.payload.findByID({
                    collection: "tools",
                    id: toolId,
                  });
                  return tool?.name || "Unknown Tool";
                }
              } catch (error) {
                console.error("Error fetching tool name:", error);
                return "Error Loading Tool";
              }
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
