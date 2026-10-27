import { pathToFileURL } from "node:url";
import type { Server } from "node:http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

export async function startServer(): Promise<Server> {
  await prisma.$connect();

  const server = app.listen(env.PORT);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  console.info(`SMARTPASS360 API listening on port ${env.PORT} (${env.NODE_ENV}).`);
  console.info(`Health endpoint: http://localhost:${env.PORT}/api/v1/health`);
  return server;
}

export async function stopServer(server: Server): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  } finally {
    await prisma.$disconnect();
  }
  console.info("SMARTPASS360 API stopped successfully.");
}

async function main(): Promise<void> {
  const server = await startServer();
  let isShuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.info(`${signal} received; shutting down SMARTPASS360 API.`);

    void stopServer(server).catch(() => {
      console.error("SMARTPASS360 API shutdown failed.");
      process.exitCode = 1;
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  main().catch(async (error: unknown) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(`SMARTPASS360 API startup failed (${errorName}).`);
    try {
      await prisma.$disconnect();
    } catch {
      // Preserve the original startup failure without logging connection details.
    }
    process.exitCode = 1;
  });
}
