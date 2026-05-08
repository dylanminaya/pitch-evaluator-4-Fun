import { z } from "zod";

const serverEnvSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DB: z.string().optional(),
  POSTGRES_PORT: z.coerce.number().optional(),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  EMAIL_FROM: z.string().email("EMAIL_FROM must be a valid email address"),
  LIBREOFFICE_BINARY: z.string().optional(),

  // Server
  PORT: z.coerce.number().default(3001),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates server environment variables.
 * Throws an error if validation fails.
 */
export function validateServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map(
        (issue) => `  • ${issue.path.join(".") || "unknown"}: ${issue.message}`,
      )
      .join("\n");

    throw new Error(
      `\n❌ Invalid server environment variables:\n\n${errors}\n`,
    );
  }

  return result.data;
}
