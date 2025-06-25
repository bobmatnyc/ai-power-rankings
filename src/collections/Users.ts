import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    tokenExpiration: 7200,
    verify: false,
    useAPIKey: false,
    cookies: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
    },
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "role", "lastLoginAt"],
  },
  access: {
    create: ({ req: { user } }) => {
      // Only admins can create new users
      return user?.["role"] === "admin";
    },
    read: ({ req: { user } }) => {
      // Admins can read all users, others can only read themselves
      if (user?.["role"] === "admin") {
        return true;
      }
      return {
        id: {
          equals: user?.id,
        },
      };
    },
    update: ({ req: { user } }) => {
      // Admins can update all users, others can only update themselves
      if (user?.["role"] === "admin") {
        return true;
      }
      return {
        id: {
          equals: user?.id,
        },
      };
    },
    delete: ({ req: { user } }) => {
      // Only admins can delete users, and they can't delete themselves
      if (user?.["role"] === "admin") {
        return {
          id: {
            not_equals: user?.id,
          },
        };
      }
      return false;
    },
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "role",
      type: "select",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Viewer", value: "viewer" },
      ],
      defaultValue: "viewer",
      required: true,
      access: {
        update: ({ req: { user } }) => user?.["role"] === "admin",
      },
    },
    {
      name: "authProvider",
      type: "select",
      options: [
        { label: "OAuth (Google)", value: "oauth" },
        { label: "Local", value: "local" },
      ],
      defaultValue: "oauth",
      admin: {
        readOnly: true,
      },
    },
    {
      name: "lastLoginAt",
      type: "date",
      admin: {
        readOnly: true,
      },
    },
  ],
  timestamps: true,
};
