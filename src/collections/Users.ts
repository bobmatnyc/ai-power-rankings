import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    tokenExpiration: 7200, // 2 hours
    verify: false, // Disable email verification for OAuth users
    maxLoginAttempts: 2,
    lockTime: 600 * 1000, // 10 minutes
    strategies: [
      {
        name: "nextauth",
        authenticate: async ({ payload }: any) => {
          // Dynamically import to avoid circular dependencies
          const { auth } = await import("@/auth");

          try {
            const session = await auth();

            if (!session?.user?.email) {
              return { user: null };
            }

            // Find or create user in Payload
            const users = await payload.find({
              collection: "users",
              where: {
                email: {
                  equals: session.user.email,
                },
              },
              limit: 1,
            });

            let user = users.docs[0];

            if (!user) {
              // Create user if doesn't exist
              user = await payload.create({
                collection: "users",
                data: {
                  email: session.user.email,
                  name: session.user.name || session.user.email,
                  password: "oauth-user",
                  role: session.user.email === "bob@matsuoka.com" ? "admin" : "viewer",
                  authProvider: "oauth",
                  lastLoginAt: new Date().toISOString(),
                },
              });
            } else {
              // Update last login
              await payload.update({
                collection: "users",
                id: user.id,
                data: {
                  lastLoginAt: new Date().toISOString(),
                },
              });
            }

            return {
              user: {
                ...user,
                collection: "users",
                _strategy: "nextauth",
              },
            };
          } catch (error) {
            console.error("NextAuth strategy error:", error);
            return { user: null };
          }
        },
      },
    ],
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
