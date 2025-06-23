import type { CollectionConfig } from "payload";

export const News: CollectionConfig = {
  slug: "news",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "source", "published_at", "category", "is_featured"],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "summary",
      type: "textarea",
      admin: {
        description: "Brief summary of the news article",
      },
    },
    {
      name: "content",
      type: "richText",
      admin: {
        description: "Full content or detailed notes about the news",
      },
    },
    {
      name: "url",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        placeholder: "https://example.com/news-article",
        description: "Original URL of the news article",
      },
    },
    {
      name: "source",
      type: "text",
      required: true,
      admin: {
        placeholder: "TechCrunch",
        description: "Publication or source name",
      },
    },
    {
      name: "author",
      type: "text",
      admin: {
        placeholder: "John Doe",
      },
    },
    {
      name: "published_at",
      type: "date",
      required: true,
      index: true,
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        description: "When the article was published",
      },
    },
    {
      name: "category",
      type: "select",
      options: [
        { label: "Funding", value: "funding" },
        { label: "Product Launch", value: "product" },
        { label: "Industry News", value: "industry" },
        { label: "Acquisition", value: "acquisition" },
        { label: "Benchmark", value: "benchmark" },
        { label: "Partnership", value: "partnership" },
      ],
      admin: {
        description: "Type of news",
      },
    },
    {
      name: "importance_score",
      type: "number",
      min: 1,
      max: 10,
      defaultValue: 5,
      admin: {
        description: "How important is this news (1-10)",
      },
    },
    {
      name: "related_tools",
      type: "relationship",
      relationTo: "tools",
      hasMany: true,
      admin: {
        description: "Tools mentioned or affected by this news",
      },
    },
    {
      name: "primary_tool",
      type: "relationship",
      relationTo: "tools",
      admin: {
        description: "Main tool this news is about",
      },
    },
    {
      name: "sentiment",
      type: "number",
      min: -1,
      max: 1,
      admin: {
        description: "Sentiment score (-1 to 1, negative to positive)",
      },
    },
    {
      name: "key_topics",
      type: "json",
      admin: {
        description: "Array of key topics/tags",
      },
    },
    {
      name: "is_featured",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Feature this news prominently",
      },
    },
  ],
  timestamps: true,
};
