// Load environment variables from .env files FIRST
import * as dotenv from 'dotenv';

// Load environment-specific config
const NODE_ENV = process.env["NODE_ENV"] || 'development';

if (NODE_ENV === 'production') {
  // In production, load .env.production.local first, then .env.production
  dotenv.config({ path: '.env.production.local' });
  dotenv.config({ path: '.env.production' });
} else {
  // In development, load .env.local first, then .env
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: '.env' });
}

import type { Config } from 'drizzle-kit';

// Use DIRECT_DATABASE_URL or DATABASE_URL_UNPOOLED for migrations (non-pooled connection)
const DATABASE_URL = process.env["DIRECT_DATABASE_URL"] || 
                     process.env["DATABASE_URL_UNPOOLED"] || 
                     process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

export default {
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
  verbose: true,
  strict: true,
} satisfies Config;