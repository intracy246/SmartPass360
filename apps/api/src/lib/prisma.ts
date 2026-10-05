import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "../config/env";

const databaseUrl = new URL(env.DATABASE_URL);

const adapter = new PrismaPg({
  host: databaseUrl.hostname,
  port: databaseUrl.port ? Number(databaseUrl.port) : 5432,
  database: databaseUrl.pathname.replace(/^\//, ""),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password)
});

export const prisma = new PrismaClient({
  adapter
});
