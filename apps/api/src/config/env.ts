import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const apiEnvPath = path.resolve(currentDir, "../../.env");

dotenv.config({ path: apiEnvPath, override: true });

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(4000),

  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  AUTH_JWT_SECRET: z
    .string()
    .min(32)
    .default("smartpass360-development-secret-change-this"),

  OWNER_USERNAME: z
    .string()
    .min(3)
    .default("smartcycle"),

  OWNER_PASSWORD: z
    .string()
    .min(8)
    .default("ChangeMe123!")
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error(
    "Invalid environment configuration:",
    parsedEnvironment.error.flatten().fieldErrors
  );

  process.exit(1);
}

export const env = parsedEnvironment.data;

export const allowedOrigins = env.CORS_ORIGIN
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
