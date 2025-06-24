import type { CollectionConfig } from "payload";

export const Tools: CollectionConfig = {
  slug: "tools",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "company", "category", "status", "current_ranking"],
  },
  access: {
    create: ({ req: { user } }) => {
      // Admins and editors can create tools
      return user?.['role'] === "admin" || user?.['role'] === "editor";
    },
    read: () => true, // All authenticated users can read tools
    update: ({ req: { user } }) => {
      // Admins and editors can update tools
      return user?.['role'] === "admin" || user?.['role'] === "editor";
    },
    delete: ({ req: { user } }) => {
      // Only admins can delete tools
      return user?.['role'] === "admin";
    },
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
      admin: {
        position: "sidebar",
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.["name"]) {
              return data["name"]
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
            }
            return value;
          },
        ],
      },
    },
    {
      name: "supabase_tool_id",
      type: "text",
      admin: {
        description: "Reference to original Supabase tools.id for migration",
        readOnly: true,
        position: "sidebar",
      },
      index: true,
    },
    {
      name: "display_name",
      type: "text",
      admin: {
        description: "Alternative display name if different from main name",
      },
    },
    {
      name: "company",
      type: "relationship",
      relationTo: "companies",
      required: true,
    },
    {
      name: "category",
      type: "select",
      options: [
        { label: "Code Editor", value: "code-editor" },
        { label: "Autonomous Agent", value: "autonomous-agent" },
        { label: "App Builder", value: "app-builder" },
        { label: "IDE Assistant", value: "ide-assistant" },
        { label: "Testing Tool", value: "testing-tool" },
        { label: "Open Source Framework", value: "open-source-framework" },
        { label: "Specialized Platform", value: "specialized-platform" },
        { label: "Documentation Tool", value: "documentation-tool" },
        { label: "Code Review", value: "code-review" },
        { label: "Enterprise Platform", value: "enterprise-platform" },
      ],
      required: true,
      index: true,
    },
    {
      name: "subcategory",
      type: "text",
      admin: {
        placeholder: "Optional subcategory",
      },
    },
    {
      name: "description",
      type: "richText",
    },
    {
      name: "tagline",
      type: "text",
      maxLength: 500,
      admin: {
        placeholder: "Short tagline or value proposition",
      },
    },
    {
      name: "website_url",
      type: "text",
      admin: {
        placeholder: "https://example.com",
      },
    },
    {
      name: "github_repo",
      type: "text",
      admin: {
        placeholder: "owner/repo",
        description: "GitHub repository in format: owner/repo",
      },
      validate: (val: any) => {
        if (!val) {
          return true;
        }
        if (!/^[\w\-\.]+\/[\w\-\.]+$/.test(val)) {
          return "Format must be: owner/repo";
        }
        return true;
      },
    },
    {
      name: "documentation_url",
      type: "text",
      admin: {
        placeholder: "https://docs.example.com",
      },
    },
    {
      name: "founded_date",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayOnly",
        },
      },
    },
    {
      name: "first_tracked_date",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayOnly",
        },
        description: "When we first started tracking this tool",
      },
    },
    {
      name: "pricing_model",
      type: "select",
      options: [
        { label: "Free", value: "free" },
        { label: "Freemium", value: "freemium" },
        { label: "Paid", value: "paid" },
        { label: "Enterprise", value: "enterprise" },
        { label: "Usage-based", value: "usage-based" },
        { label: "Open Source", value: "open-source" },
      ],
      required: true,
    },
    {
      name: "license_type",
      type: "select",
      options: [
        { label: "Open Source", value: "open-source" },
        { label: "Proprietary", value: "proprietary" },
        { label: "Commercial", value: "commercial" },
        { label: "MIT", value: "mit" },
        { label: "Apache", value: "apache" },
        { label: "GPL", value: "gpl" },
      ],
      required: true,
    },
    {
      name: "status",
      type: "select",
      options: [
        { label: "Active", value: "active" },
        { label: "Discontinued", value: "discontinued" },
        { label: "Beta", value: "beta" },
        { label: "Stealth", value: "stealth" },
        { label: "Acquired", value: "acquired" },
      ],
      defaultValue: "active",
      index: true,
    },
    {
      name: "logo_url",
      type: "text",
      admin: {
        placeholder: "https://example.com/logo.png",
      },
    },
    {
      name: "screenshot_url",
      type: "text",
      admin: {
        placeholder: "https://example.com/screenshot.png",
      },
    },
    {
      name: "is_featured",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "current_ranking",
      type: "number",
      min: 1,
      index: true,
      admin: {
        position: "sidebar",
        description: "Current ranking position",
      },
    },
    {
      name: "the_real_story",
      type: "richText",
      admin: {
        description: "Editorial analysis explaining this tool's current position and trajectory",
      },
    },
    {
      name: "competitive_analysis",
      type: "richText",
      admin: {
        description: "How this tool compares to its competitors",
      },
    },
    {
      name: "key_developments",
      type: "json",
      admin: {
        description: "Array of key developments",
      },
    },
    {
      name: "notable_events",
      type: "json",
      admin: {
        description: "Array of notable events",
      },
    },
  ],
  timestamps: true,
};
