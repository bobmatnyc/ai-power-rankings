import type { CollectionConfig } from "payload";

export const Metrics: CollectionConfig = {
  slug: "metrics",
  admin: {
    useAsTitle: "metric_key",
    defaultColumns: ["tool_display", "metric_key", "value_display", "recorded_at"],
    group: "Data",
    listSearchableFields: ["metric_key", "tool.name"],
    pagination: {
      defaultLimit: 25,
    },
    defaultSort: "-recorded_at",
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
      name: "metric_key",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "e.g., github_stars, github_forks, weekly_downloads",
      },
    },
    {
      name: "supabase_metric_id",
      type: "text",
      admin: {
        description: "Reference to original Supabase metrics_history.id",
        readOnly: true,
        position: "sidebar",
      },
    },
    {
      name: "value_integer",
      type: "number",
      admin: {
        description: "For whole number values",
      },
    },
    {
      name: "value_decimal",
      type: "number",
      admin: {
        description: "For decimal values",
      },
    },
    {
      name: "value_text",
      type: "text",
      admin: {
        description: "For text values",
      },
    },
    {
      name: "value_boolean",
      type: "checkbox",
      admin: {
        description: "For true/false values",
      },
    },
    {
      name: "value_json",
      type: "json",
      admin: {
        description: "For complex structured data",
      },
    },
    {
      name: "recorded_at",
      type: "date",
      required: true,
      index: true,
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        description: "When this metric value was recorded",
      },
    },
    {
      name: "collected_at",
      type: "date",
      defaultValue: () => new Date(),
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        description: "When this metric was collected",
      },
    },
    {
      name: "source",
      type: "text",
      defaultValue: "manual_entry",
      admin: {
        description: "Source of this metric (e.g., api, scraper, manual)",
      },
    },
    {
      name: "source_url",
      type: "text",
      admin: {
        placeholder: "https://api.github.com/repos/owner/repo",
        description: "URL where this metric was collected from",
      },
    },
    {
      name: "confidence_score",
      type: "number",
      min: 0,
      max: 1,
      defaultValue: 1.0,
      admin: {
        description: "Confidence in the accuracy of this metric (0-1)",
      },
    },
    {
      name: "notes",
      type: "textarea",
      admin: {
        description: "Any additional notes about this metric",
      },
    },
    {
      name: "is_estimate",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "Is this an estimated value?",
      },
    },
    {
      name: "value_display",
      type: "text",
      admin: {
        readOnly: true,
        description: "Display value calculated from the stored values",
      },
      hooks: {
        beforeChange: [
          ({ data }) => {
            if (data?.["value_integer"] !== undefined) {
              return data["value_integer"].toString();
            }
            if (data?.["value_decimal"] !== undefined) {
              return data["value_decimal"].toString();
            }
            if (data?.["value_text"] !== undefined) {
              return data["value_text"];
            }
            if (data?.["value_boolean"] !== undefined) {
              return data["value_boolean"] ? "true" : "false";
            }
            if (data?.["value_json"] !== undefined) {
              return JSON.stringify(data["value_json"]);
            }
            return "";
          },
        ],
      },
    },
  ],
  timestamps: true,
};
