import type { CollectionConfig } from "payload";

export const Rankings: CollectionConfig = {
  slug: "rankings",
  admin: {
    useAsTitle: "period",
    defaultColumns: ["period", "tool", "position", "score", "movement"],
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
      defaultValue: "v4.0",
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
