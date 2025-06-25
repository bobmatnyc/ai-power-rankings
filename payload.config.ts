import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { resendAdapter } from "@payloadcms/email-resend";

// Collections
import {
  Companies,
  Tools,
  PendingTools,
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
      connectionString: process.env["SUPABASE_DATABASE_URL"] || process.env["DATABASE_URL"] || "",
      max: parseInt(process.env["DATABASE_POOL_MAX"] || "1"),
      min: parseInt(process.env["DATABASE_POOL_MIN"] || "0"),
      idleTimeoutMillis: parseInt(process.env["DATABASE_IDLE_TIMEOUT"] || "10000"),
      connectionTimeoutMillis: parseInt(process.env["DATABASE_CONNECT_TIMEOUT"] || "10000"),
    },
    schemaName: "payload",
    migrationDir: "./src/migrations",
    logger: false, // Disable query logging
    push: false, // Disable automatic schema push in development
  }),
  email: process.env["RESEND_API_KEY"]
    ? resendAdapter({
        apiKey: process.env["RESEND_API_KEY"],
        defaultFromAddress: process.env["EMAIL_FROM"] || "noreply@aipowerrankings.com",
        defaultFromName: "AI Power Rankings",
      })
    : undefined,
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: "- AI Power Rankings CMS",
    },
    disable: false,
    dateFormat: "MMMM do, yyyy h:mm a",
  },
  collections: [
    Users,
    Companies,
    Tools,
    PendingTools,
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
    locales: ["en", "de", "fr", "it", "ja", "ko", "uk", "hr", "zh"],
    defaultLocale: "en",
    fallback: true,
  },
  onInit: async (payload) => {
    // Skip database operations if no database is configured
    if (!process.env["SUPABASE_DATABASE_URL"] && !process.env["DATABASE_URL"]) {
      return;
    }

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
