import type { CollectionConfig } from "payload";

export const IngestionReports: CollectionConfig = {
  slug: "ingestion-reports",
  admin: {
    useAsTitle: "file_name",
    defaultColumns: ["file_name", "processed_at", "total_articles", "ingested", "duplicates_removed"],
    group: "System",
  },
  fields: [
    {
      name: "file_name",
      type: "text",
      required: true,
      admin: {
        description: "Name of the processed file",
      },
    },
    {
      name: "file_id",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Google Drive file ID",
      },
    },
    {
      name: "processed_at",
      type: "date",
      required: true,
      index: true,
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        description: "When the file was processed",
      },
    },
    {
      name: "total_articles",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: {
        description: "Total number of articles in the file",
      },
    },
    {
      name: "ingested",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: {
        description: "Number of articles successfully ingested",
      },
    },
    {
      name: "duplicates_removed",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: {
        description: "Number of duplicate articles removed",
      },
    },
    {
      name: "validation_errors",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: {
        description: "Number of validation errors encountered",
      },
    },
    {
      name: "errors",
      type: "json",
      admin: {
        description: "Array of error messages",
      },
    },
    {
      name: "ingested_articles",
      type: "json",
      admin: {
        description: "Details of ingested articles",
      },
    },
    {
      name: "report",
      type: "json",
      admin: {
        description: "Full ingestion report data",
      },
    },
  ],
  timestamps: true,
  access: {
    // Only admins can access ingestion reports
    create: ({ req: { user } }) => !!user,
    read: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
};