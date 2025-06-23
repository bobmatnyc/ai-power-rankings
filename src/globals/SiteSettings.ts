import type { GlobalConfig } from "payload";

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  admin: {
    description: "Global configuration for the AI Power Rankings site",
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Algorithm Settings",
          fields: [
            {
              name: "algorithm_version",
              type: "text",
              defaultValue: "v4.0",
              required: true,
              admin: {
                description: "Current algorithm version",
              },
            },
            {
              name: "market_traction_weight",
              type: "number",
              defaultValue: 0.25,
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: "Weight for market traction score (default: 25%)",
              },
            },
            {
              name: "technical_capability_weight",
              type: "number",
              defaultValue: 0.25,
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: "Weight for technical capability score (default: 25%)",
              },
            },
            {
              name: "developer_adoption_weight",
              type: "number",
              defaultValue: 0.2,
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: "Weight for developer adoption score (default: 20%)",
              },
            },
            {
              name: "development_velocity_weight",
              type: "number",
              defaultValue: 0.15,
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: "Weight for development velocity score (default: 15%)",
              },
            },
            {
              name: "platform_resilience_weight",
              type: "number",
              defaultValue: 0.1,
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: "Weight for platform resilience score (default: 10%)",
              },
            },
            {
              name: "community_sentiment_weight",
              type: "number",
              defaultValue: 0.05,
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: "Weight for community sentiment score (default: 5%)",
              },
            },
          ],
        },
        {
          label: "Site Configuration",
          fields: [
            {
              name: "site_name",
              type: "text",
              defaultValue: "AI Power Rankings",
              required: true,
            },
            {
              name: "site_description",
              type: "textarea",
              defaultValue:
                "Tracking the top AI coding tools based on real-world adoption and performance metrics",
            },
            {
              name: "contact_email",
              type: "email",
              required: true,
              admin: {
                placeholder: "contact@aipowerrankings.com",
              },
            },
            {
              name: "ranking_update_frequency",
              type: "select",
              options: [
                { label: "Daily", value: "daily" },
                { label: "Weekly", value: "weekly" },
                { label: "Bi-weekly", value: "biweekly" },
                { label: "Monthly", value: "monthly" },
              ],
              defaultValue: "weekly",
              required: true,
            },
            {
              name: "show_top_n_tools",
              type: "number",
              defaultValue: 50,
              min: 10,
              max: 100,
              required: true,
              admin: {
                description: "Number of tools to show in the main rankings",
              },
            },
          ],
        },
        {
          label: "Feature Flags",
          fields: [
            {
              name: "enable_user_submissions",
              type: "checkbox",
              defaultValue: false,
              admin: {
                description: "Allow users to submit new tools",
              },
            },
            {
              name: "enable_comments",
              type: "checkbox",
              defaultValue: false,
              admin: {
                description: "Enable commenting on tools",
              },
            },
            {
              name: "enable_api_access",
              type: "checkbox",
              defaultValue: true,
              admin: {
                description: "Enable public API access",
              },
            },
            {
              name: "maintenance_mode",
              type: "checkbox",
              defaultValue: false,
              admin: {
                description: "Put the site in maintenance mode",
              },
            },
          ],
        },
      ],
    },
  ],
};
