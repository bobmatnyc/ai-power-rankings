import { CollectionConfig } from "payload";

export const PendingTools: CollectionConfig = {
  slug: "pending-tools",
  admin: {
    useAsTitle: "name",
    group: "Content Management",
    defaultColumns: ["name", "suggested_category", "status", "created_from", "createdAt"],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "suggested_category",
      type: "select",
      required: true,
      options: [
        { label: "Autonomous Agent", value: "autonomous-agent" },
        { label: "AI Assistant", value: "ai-assistant" },
        { label: "IDE Assistant", value: "ide-assistant" },
        { label: "Code Editor", value: "code-editor" },
        { label: "Open Source Framework", value: "open-source-framework" },
        { label: "App Builder", value: "app-builder" },
        { label: "Code Generation", value: "code-generation" },
        { label: "Code Review", value: "code-review" },
        { label: "Testing Tool", value: "testing-tool" },
      ],
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "website_url",
      type: "text",
    },
    {
      name: "created_from",
      type: "select",
      required: true,
      options: [
        { label: "News Ingestion", value: "news" },
        { label: "Manual Entry", value: "manual" },
        { label: "API Import", value: "api" },
      ],
    },
    {
      name: "source_info",
      type: "group",
      fields: [
        {
          name: "source_name",
          type: "text",
          admin: {
            description: "Name of the news source or origin",
          },
        },
        {
          name: "source_url",
          type: "text",
          admin: {
            description: "URL of the article/source that mentioned this tool",
          },
        },
        {
          name: "context",
          type: "textarea",
          admin: {
            description: "Context from the source where this tool was mentioned",
          },
        },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pending Review", value: "pending" },
        { label: "Approved - Create New", value: "approved_new" },
        { label: "Approved - Merge with Existing", value: "approved_merge" },
        { label: "Rejected", value: "rejected" },
        { label: "Processed", value: "processed" },
      ],
    },
    {
      name: "merge_with_tool",
      type: "relationship",
      relationTo: "tools",
      admin: {
        description: "If merging, select the existing tool to merge with",
        condition: (data) => data['status'] === "approved_merge",
      },
    },
    {
      name: "admin_notes",
      type: "textarea",
      admin: {
        description: "Admin notes about the decision",
      },
    },
    {
      name: "potential_matches",
      type: "array",
      admin: {
        description: "Potential existing tools that this might be duplicate of",
      },
      fields: [
        {
          name: "tool",
          type: "relationship",
          relationTo: "tools",
          required: true,
        },
        {
          name: "similarity_score",
          type: "number",
          min: 0,
          max: 1,
          admin: {
            description: "Similarity score (0-1)",
          },
        },
        {
          name: "reason",
          type: "text",
          admin: {
            description: "Why this might be a match",
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === "create" && !data['slug']) {
          // Auto-generate slug from name
          data['slug'] = data['name']
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        }
        return data;
      },
    ],
  },
};
