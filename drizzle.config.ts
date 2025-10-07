import type { Config } from "drizzle-kit";

export default {
  schema: ["./lib/db/schema.ts", "./lib/db/article-schema.ts"],
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;