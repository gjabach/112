import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || 'local',
    databaseId: 'novelist-db-local',
    token: process.env.CLOUDFLARE_D1_TOKEN || 'local-token'
  }
} satisfies Config;
