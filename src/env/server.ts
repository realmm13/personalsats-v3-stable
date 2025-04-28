// src/env/server.ts
import { z } from 'zod'

// Define the schema for server-side environment variables
const serverEnvSchema = z.object({
  DATABASE_URL:        z.string().url(),
  CRON_SECRET:         z.string().min(1, { message: "CRON_SECRET must be set for cron job security" }),
  CRYPTOCOMPARE_API_KEY: z.string().min(1, { message: "CRYPTOCOMPARE_API_KEY must be set" }),
  // Add other server-side variables below as needed
  // e.g., NEXTAUTH_SECRET: z.string().min(1),
  // e.g., GITHUB_CLIENT_ID: z.string().min(1),
  // e.g., GITHUB_CLIENT_SECRET: z.string().min(1),
});

// Parse process.env using the schema
// This will throw an error at build time if required variables are missing
export const serverEnv = serverEnvSchema.parse(process.env); 