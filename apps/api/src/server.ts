import { app } from "./app";
import { env } from "./config/env";

const server = app.listen(env.PORT, () => {
  console.log("");
  console.log("==========================================");
  console.log("       SMARTPASS360 API IS RUNNING");
  console.log("==========================================");
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Port:        ${env.PORT}`);
  console.log(`Health:      http://localhost:${env.PORT}/api/v1/health`);
  console.log("==========================================");
  console.log("");
});

function shutdown(signal: string): void {
  console.log(`${signal} received. Closing SMARTPASS360 API...`);

  server.close((error) => {
    if (error) {
      console.error("Server shutdown failed:", error);
      process.exit(1);
    }

    console.log("SMARTPASS360 API stopped successfully.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));