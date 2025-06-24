import type { CollectionConfig } from "payload";

export const ProcessedFiles: CollectionConfig = {
  slug: "processed-files",
  admin: {
    useAsTitle: "file_name",
    defaultColumns: ["file_name", "processed_at", "articles_ingested", "validation_errors"],
    group: "System",
  },
  fields: [
    {
      name: "file_id",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Google Drive file ID",
      },
    },
    {
      name: "file_name",
      type: "text",
      required: true,
      admin: {
        description: "Name of the processed file",
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
      name: "articles_ingested",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: {
        description: "Number of articles successfully ingested",
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
  ],
  timestamps: true,
  access: {
    // Only admins can access processed files tracking
    create: ({ req: { user } }) => !!user,
    read: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
};