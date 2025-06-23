import type { CollectionConfig } from "payload";

export const Companies: CollectionConfig = {
  slug: "companies",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "company_type", "founded_year", "website_url"],
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
      name: "supabase_company_id",
      type: "text",
      admin: {
        description: "Reference to original Supabase companies.id for migration",
        readOnly: true,
        position: "sidebar",
      },
      index: true,
    },
    {
      name: "website_url",
      type: "text",
      admin: {
        placeholder: "https://example.com",
      },
    },
    {
      name: "headquarters",
      type: "text",
      admin: {
        placeholder: "San Francisco, CA",
      },
    },
    {
      name: "founded_year",
      type: "number",
      min: 1900,
      max: new Date().getFullYear(),
    },
    {
      name: "company_size",
      type: "select",
      options: [
        { label: "Startup (1-50)", value: "startup" },
        { label: "Small (51-200)", value: "small" },
        { label: "Medium (201-1000)", value: "medium" },
        { label: "Large (1001-5000)", value: "large" },
        { label: "Enterprise (5000+)", value: "enterprise" },
      ],
    },
    {
      name: "company_type",
      type: "select",
      options: [
        { label: "Startup", value: "startup" },
        { label: "Public", value: "public" },
        { label: "Private", value: "private" },
        { label: "Acquisition", value: "acquisition" },
      ],
    },
    {
      name: "parent_company",
      type: "relationship",
      relationTo: "companies",
      admin: {
        description: "If this company is owned by another company",
      },
    },
    {
      name: "logo_url",
      type: "text",
      admin: {
        placeholder: "https://example.com/logo.png",
      },
    },
    {
      name: "description",
      type: "richText",
    },
  ],
  timestamps: true,
};
