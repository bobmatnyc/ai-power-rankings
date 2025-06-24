import type { CollectionConfig } from "payload";

export const NewsIngestionReports: CollectionConfig = {
  slug: "news-ingestion-reports",
  admin: {
    useAsTitle: "filename",
    defaultColumns: ["filename", "status", "processed_items", "createdAt"],
    group: "Administration",
  },
  access: {
    create: ({ req: { user } }) => user?.['role'] === "admin" || user?.['role'] === "editor",
    read: ({ req: { user } }) => user?.['role'] === "admin" || user?.['role'] === "editor",
    update: ({ req: { user } }) => user?.['role'] === "admin",
    delete: ({ req: { user } }) => user?.['role'] === "admin",
  },
  fields: [
    {
      name: "filename",
      type: "text",
      required: true,
      admin: {
        description: "Name of the uploaded JSON file",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "processing",
      options: [
        { label: "Processing", value: "processing" },
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
        { label: "Partial", value: "partial" },
      ],
    },
    {
      name: "total_items",
      type: "number",
      admin: {
        description: "Total number of news items in the file",
      },
    },
    {
      name: "processed_items",
      type: "number",
      admin: {
        description: "Number of items successfully processed",
      },
    },
    {
      name: "failed_items",
      type: "number",
      admin: {
        description: "Number of items that failed to process",
      },
    },
    {
      name: "duplicate_items",
      type: "number",
      admin: {
        description: "Number of duplicate items skipped",
      },
    },
    {
      name: "new_tools_created",
      type: "number",
      admin: {
        description: "Number of new tools created during ingestion",
      },
    },
    {
      name: "new_companies_created",
      type: "number",
      admin: {
        description: "Number of new companies created during ingestion",
      },
    },
    {
      name: "ranking_preview_generated",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "Whether a ranking preview was generated",
      },
    },
    {
      name: "processing_log",
      type: "textarea",
      admin: {
        description: "Detailed processing log",
      },
    },
    {
      name: "errors",
      type: "json",
      admin: {
        description: "Array of error details",
      },
    },
    {
      name: "ingested_news_ids",
      type: "json",
      admin: {
        description: "Array of news item IDs that were successfully created",
      },
    },
    {
      name: "created_tools",
      type: "json",
      admin: {
        description: "Details of new tools created",
      },
    },
    {
      name: "created_companies",
      type: "json",
      admin: {
        description: "Details of new companies created",
      },
    },
    {
      name: "ranking_changes_preview",
      type: "json",
      admin: {
        description: "Preview of how rankings would change",
      },
    },
    {
      name: "file_size",
      type: "number",
      admin: {
        description: "File size in bytes",
      },
    },
    {
      name: "processing_duration",
      type: "number",
      admin: {
        description: "Processing time in milliseconds",
      },
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      admin: {
        description: "User who uploaded the file",
      },
    },
  ],
  timestamps: true,
  indexes: [
    {
      fields: ["status", "createdAt"],
    },
  ],
};