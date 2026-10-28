import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Workspace scripts and the production systemd unit both run from apps/api.
// dotenv only fills unset values, so systemd and shell configuration wins.
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

const nodeEnvironment = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnvironment === "development";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must contain at least 32 characters").optional(),
  PERMANENT_PASS_QR_ENCRYPTION_KEY: z.string().min(32).optional(),
  OWNER_USERNAME: z.string().min(3).optional(),
  OWNER_PASSWORD: z.string().min(8).optional()
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const invalidVariables = [...new Set(parsedEnvironment.error.issues.map((issue) => String(issue.path[0])))];
  console.error(`Invalid environment configuration: ${invalidVariables.join(", ")}`);
  process.exit(1);
}

const configured = parsedEnvironment.data;
const configurationErrors: string[] = [];

try {
  const databaseUrl = new URL(configured.DATABASE_URL);
  if (databaseUrl.protocol !== "postgresql:" && databaseUrl.protocol !== "postgres:") {
    configurationErrors.push("DATABASE_URL");
  }
} catch {
  configurationErrors.push("DATABASE_URL");
}

const configuredOrigins = configured.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];
for (const origin of configuredOrigins) {
  try {
    const parsedOrigin = new URL(origin);
    if ((parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") || parsedOrigin.origin !== origin) {
      configurationErrors.push("CORS_ORIGIN");
      break;
    }
  } catch {
    configurationErrors.push("CORS_ORIGIN");
    break;
  }
}

const developmentJwtSecret = "smartpass360-development-secret-change-this";
const developmentOwnerPassword = "ChangeMe123!";
const authJwtSecret = configured.AUTH_JWT_SECRET ?? (isDevelopment ? developmentJwtSecret : undefined);
const ownerUsername = configured.OWNER_USERNAME ?? (isDevelopment ? "smartcycle" : undefined);
const ownerPassword = configured.OWNER_PASSWORD ?? (isDevelopment ? developmentOwnerPassword : undefined);

if (!authJwtSecret) configurationErrors.push("AUTH_JWT_SECRET");
if (!ownerUsername) configurationErrors.push("OWNER_USERNAME");
if (!ownerPassword) configurationErrors.push("OWNER_PASSWORD");

if (configured.NODE_ENV === "production") {
  if (authJwtSecret === developmentJwtSecret) configurationErrors.push("AUTH_JWT_SECRET");
  if (!configured.PERMANENT_PASS_QR_ENCRYPTION_KEY) configurationErrors.push("PERMANENT_PASS_QR_ENCRYPTION_KEY");
  if (configured.PERMANENT_PASS_QR_ENCRYPTION_KEY === authJwtSecret) configurationErrors.push("PERMANENT_PASS_QR_ENCRYPTION_KEY");
  if (ownerUsername === "smartcycle") configurationErrors.push("OWNER_USERNAME");
  if (ownerPassword === developmentOwnerPassword) configurationErrors.push("OWNER_PASSWORD");
  if (!configured.CORS_ORIGIN?.trim()) configurationErrors.push("CORS_ORIGIN");
}

if (configurationErrors.length > 0) {
  const invalidVariables = [...new Set(configurationErrors)];
  console.error(`Invalid environment configuration: ${invalidVariables.join(", ")}`);
  process.exit(1);
}

export const env = {
  ...configured,
  AUTH_JWT_SECRET: authJwtSecret!,
  PERMANENT_PASS_QR_ENCRYPTION_KEY: configured.PERMANENT_PASS_QR_ENCRYPTION_KEY ?? (configured.NODE_ENV !== "production" ? authJwtSecret! : ""),
  OWNER_USERNAME: ownerUsername!,
  OWNER_PASSWORD: ownerPassword!,
  CORS_ORIGIN: configured.CORS_ORIGIN ?? ""
} as const;

const developmentOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
];

export const allowedOrigins = [
  ...new Set([
    ...env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
    ...(env.NODE_ENV === "development" ? developmentOrigins : [])
  ])
];
