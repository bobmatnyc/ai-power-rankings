import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";

// Collections
import { Companies, Tools, Metrics, Rankings, News, Users } from "./src/collections";

// Globals
import { SiteSettings } from "./src/globals/SiteSettings";

export default buildConfig({
  secret: process.env["PAYLOAD_SECRET"] || "fallback-secret-for-dev",
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: {
      connectionString: process.env["SUPABASE_DATABASE_URL"] || "",
    },
    schemaName: "payload",
  }),
  admin: {
    user: Users.slug,
    components: {},
    meta: {
      titleSuffix: "- AI Power Rankings CMS",
    },
  },
  collections: [Users, Companies, Tools, Metrics, Rankings, News],
  globals: [SiteSettings],
  typescript: {
    outputFile: "src/types/payload-types.ts",
  },
  localization: {
    locales: ["en", "ja"],
    defaultLocale: "en",
    fallback: true,
  },
});
