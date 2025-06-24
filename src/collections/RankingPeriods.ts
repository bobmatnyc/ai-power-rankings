import type { CollectionConfig } from "payload";

export const RankingPeriods: CollectionConfig = {
  slug: "ranking-periods",
  admin: {
    useAsTitle: "display_name",
    defaultColumns: ["period", "display_name", "status", "calculation_date"],
    group: "Rankings",
  },
  access: {
    create: ({ req: { user } }) => user?.['role'] === "admin",
    read: () => true,
    update: ({ req: { user } }) => user?.['role'] === "admin",
    delete: ({ req: { user } }) => user?.['role'] === "admin",
  },
  fields: [
    {
      name: "period",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Unique period identifier (e.g., june-2025, 2025-W25, Q2-2025)",
      },
    },
    {
      name: "display_name",
      type: "text",
      required: true,
      admin: {
        description: "Human-readable name (e.g., June 2025, Week 25 2025)",
      },
    },
    {
      name: "period_type",
      type: "select",
      required: true,
      options: [
        { label: "Monthly", value: "monthly" },
        { label: "Weekly", value: "weekly" },
        { label: "Quarterly", value: "quarterly" },
        { label: "Special Event", value: "special" },
      ],
      admin: {
        description: "Type of ranking period",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Calculating", value: "calculating" },
        { label: "Preview", value: "preview" },
        { label: "Published", value: "published" },
        { label: "Archived", value: "archived" },
      ],
      admin: {
        description: "Current status of this ranking period",
      },
    },
    {
      name: "calculation_date",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        description: "When rankings were calculated",
      },
    },
    {
      name: "publish_date",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        description: "When rankings were published",
      },
    },
    {
      name: "start_date",
      type: "date",
      required: true,
      admin: {
        description: "Period start date",
      },
    },
    {
      name: "end_date",
      type: "date",
      required: true,
      admin: {
        description: "Period end date",
      },
    },
    {
      name: "algorithm_version",
      type: "text",
      defaultValue: "v6.0",
      admin: {
        description: "Ranking algorithm version used",
      },
    },
    {
      name: "total_tools",
      type: "number",
      admin: {
        description: "Number of tools ranked in this period",
      },
    },
    {
      name: "data_cutoff_date",
      type: "date",
      admin: {
        description: "Latest date of data included in rankings",
      },
    },
    {
      name: "notes",
      type: "textarea",
      admin: {
        description: "Internal notes about this ranking period",
      },
    },
    {
      name: "changelog",
      type: "richText",
      admin: {
        description: "Changes and highlights for this period",
      },
    },
    {
      name: "metadata",
      type: "json",
      admin: {
        description: "Additional metadata about calculation process",
      },
    },
  ],
  timestamps: true,
  indexes: [
    {
      fields: ["period"],
      unique: true,
    },
    {
      fields: ["status", "period_type"],
    },
  ],
};