import type { CollectionConfig } from "payload";

export const NewsletterSubscribers: CollectionConfig = {
  slug: "newsletter-subscribers",
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "first_name", "last_name", "status", "created_at"],
    group: "Content",
  },
  fields: [
    {
      name: "email",
      type: "email",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Subscriber's email address",
      },
    },
    {
      name: "first_name",
      type: "text",
      required: true,
      admin: {
        placeholder: "John",
      },
    },
    {
      name: "last_name",
      type: "text",
      required: true,
      admin: {
        placeholder: "Doe",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Verified", value: "verified" },
        { label: "Unsubscribed", value: "unsubscribed" },
      ],
      admin: {
        description: "Subscription status",
      },
    },
    {
      name: "verification_token",
      type: "text",
      unique: true,
      index: true,
      admin: {
        hidden: true,
        description: "Token for email verification",
      },
    },
    {
      name: "verified_at",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        description: "When the email was verified",
      },
    },
    {
      name: "unsubscribed_at",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        description: "When the user unsubscribed",
      },
    },
    {
      name: "metadata",
      type: "json",
      admin: {
        description: "Additional metadata (source, tags, preferences, etc.)",
      },
    },
  ],
  timestamps: true,
  access: {
    // Public can create (subscribe)
    create: () => true,
    // Only admins can read/update/delete
    read: ({ req: { user } }) => {
      if (user) {
        return true;
      }
      return false;
    },
    update: ({ req: { user } }) => {
      if (user) {
        return true;
      }
      return false;
    },
    delete: ({ req: { user } }) => {
      if (user) {
        return true;
      }
      return false;
    },
  },
};