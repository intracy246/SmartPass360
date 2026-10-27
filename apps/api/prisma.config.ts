import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const apiEnvPath = path.resolve(currentDir, ".env");

dotenv.config({ path: apiEnvPath, override: false });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run Prisma CLI commands.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations"
  },

  datasource: {
    url: process.env.DATABASE_URL
  }
});
