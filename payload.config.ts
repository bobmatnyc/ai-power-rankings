import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";

// Collections
import {
  Companies,
  Tools,
  Metrics,
  Rankings,
  RankingPeriods,
  News,
  NewsIngestionReports,
  Users,
  NewsletterSubscribers,
  ProcessedFiles,
  IngestionReports,
} from "./src/collections";

// Globals
import { SiteSettings } from "./src/globals/SiteSettings";

export default buildConfig({
  secret: process.env["PAYLOAD_SECRET"] || "fallback-secret-for-dev",
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: {
      connectionString: process.env["SUPABASE_DATABASE_URL"] || "",
      max: process.env.NODE_ENV === "development" ? 5 : 1, // Higher for dev, 1 for serverless
      min: process.env.NODE_ENV === "development" ? 1 : 0, // Allow pool to shrink to 0 in production
      idleTimeoutMillis: 10000, // 10 seconds
      connectionTimeoutMillis: 30000, // 30 seconds
    },
    schemaName: "payload",
    migrationDir: "./src/migrations",
    logger: process.env["NODE_ENV"] === "development", // Enable for dev
    push: false, // Disable automatic schema push in development
  }),
  email:
    process.env.NODE_ENV === "development"
      ? undefined
      : nodemailerAdapter({
          defaultFromAddress: process.env["EMAIL_FROM"] || "noreply@localhost",
          defaultFromName: "AI Power Rankings",
          transportOptions: {
            // Production SMTP settings
            host: process.env["SMTP_HOST"] || "smtp.gmail.com",
            port: parseInt(process.env["SMTP_PORT"] || "587"),
            secure: process.env["SMTP_SECURE"] === "true",
            auth: {
              user: process.env["SMTP_USER"],
              pass: process.env["SMTP_PASS"],
            },
          },
        }),
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: "- AI Power Rankings CMS",
    },
    disable: false,
  },
  collections: [
    Users,
    Companies,
    Tools,
    Metrics,
    Rankings,
    RankingPeriods,
    News,
    NewsIngestionReports,
    NewsletterSubscribers,
    ProcessedFiles,
    IngestionReports,
  ],
  globals: [SiteSettings],
  typescript: {
    outputFile: "src/types/payload-types.ts",
  },
  localization: {
    locales: ["en", "ja"],
    defaultLocale: "en",
    fallback: true,
  },
  onInit: async (payload) => {
    // Create initial admin user if none exists
    const existingUsers = await payload.find({
      collection: "users",
      limit: 1,
    });

    if (existingUsers.docs.length === 0) {
      // Create bob@matsuoka.com as default admin
      await payload.create({
        collection: "users",
        data: {
          email: "bob@matsuoka.com",
          password: "temp-password", // This will be bypassed by OAuth
          name: "Bob Matsuoka",
          role: "admin",
        },
      });
    }

    // Ensure bob@matsuoka.com has admin role
    const bobUser = await payload.find({
      collection: "users",
      where: {
        email: {
          equals: "bob@matsuoka.com",
        },
      },
    });

    if (bobUser.docs.length === 0) {
      await payload.create({
        collection: "users",
        data: {
          email: "bob@matsuoka.com",
          password: "oauth-user", // This will be bypassed by OAuth
          name: "Bob Matsuoka",
          role: "admin",
        },
      });
    } else if (bobUser.docs.length > 0) {
      const user = bobUser.docs[0];
      if (user && user["role"] !== "admin") {
        await payload.update({
          collection: "users",
          id: user.id,
          data: {
            role: "admin",
          },
        });
      }
    }
  },
});
