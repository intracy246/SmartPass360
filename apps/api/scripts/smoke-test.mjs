import assert from "node:assert/strict";
import { createServer } from "node:net";
import dotenv from "dotenv";

const portServer = createServer();
await new Promise((resolve, reject) => {
  portServer.once("error", reject);
  portServer.listen(0, "127.0.0.1", resolve);
});
const address = portServer.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise((resolve, reject) => portServer.close((error) => error ? reject(error) : resolve()));

Object.assign(process.env, {
  NODE_ENV: "production",
  PORT: String(port),
  CORS_ORIGIN: "https://dashboard.example.test",
  AUTH_JWT_SECRET: "smoke-test-only-random-secret-never-use-in-production",
  PERMANENT_PASS_QR_ENCRYPTION_KEY: "smoke-test-only-distinct-qr-encryption-key",
  OWNER_USERNAME: "smoke-test-owner",
  OWNER_PASSWORD: "smoke-test-owner-password"
});
dotenv.config({ path: ".env", override: false, quiet: true });

const { startServer, stopServer } = await import("../dist/server.js");
const server = await startServer();

try {
  const healthResponse = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.status, "ONLINE");
  assert.ok(healthResponse.headers.get("x-request-id"));
  assert.equal(healthResponse.headers.get("access-control-allow-origin"), null);

  const trustedOriginResponse = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
    headers: { Origin: "https://dashboard.example.test" }
  });
  assert.equal(trustedOriginResponse.headers.get("access-control-allow-origin"), "https://dashboard.example.test");

  const localOriginResponse = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
    headers: { Origin: "http://localhost:5173" }
  });
  assert.equal(localOriginResponse.headers.get("access-control-allow-origin"), null);

  const readinessResponse = await fetch(`http://127.0.0.1:${port}/api/v1/ready`);
  assert.equal(readinessResponse.status, 200);
  assert.equal((await readinessResponse.json()).status, "READY");

  const notFoundResponse = await fetch(`http://127.0.0.1:${port}/api/v1/__smoke_test_not_found__`);
  assert.equal(notFoundResponse.status, 404);
  const notFound = await notFoundResponse.json();
  assert.equal(notFound.error.code, "ROUTE_NOT_FOUND");

  console.log("Production runtime smoke test passed: health 200, database readiness, trusted CORS, and unknown route 404.");
} finally {
  await stopServer(server);
  console.log("Production runtime smoke test passed: HTTP server and Prisma client closed cleanly.");
}
