import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { allowedOrigins } from "./config/env.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { notFoundHandler } from "./middleware/not-found.middleware.js";
import { prisma } from "./lib/prisma.js";
import { healthRouter } from "./routes/health.routes.js";
import { accessRouter } from "./routes/access.routes.js";
import { permanentPassRouter } from "./routes/permanent-pass.routes.js";
import { organizationRouter } from "./routes/organization.routes.js";
import { kioskRouter } from "./routes/kiosk.routes.js";
import { ownerRouter } from "./routes/owner.routes.js";
import { visitorRouter } from "./routes/visitor.routes.js";
import { visitorPassRouter } from "./routes/visitor-pass.routes.js";
import { vehicleAccessRouter } from "./routes/vehicle-access.routes.js";

export const app = express();

app.disable("x-powered-by");

app.use(
  pinoHttp({
    redact: ["req.headers.authorization", "req.headers.cookie"],
    genReqId: (request, response) => {
      const existingRequestId = request.headers["x-request-id"];

      const requestId =
        typeof existingRequestId === "string"
          ? existingRequestId
          : crypto.randomUUID();

      response.setHeader("x-request-id", requestId);

      return requestId;
    }
  })
);

app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({ extended: true }));

app.get("/api/v1/ready", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({ success: true, status: "READY" });
  } catch {
    response.status(503).json({ success: false, status: "NOT_READY" });
  }
});

app.get("/", (_request, response) => {
  response.status(200).json({
    success: true,
    message: "Welcome to SMARTPASS360 API",
    healthEndpoint: "/api/v1/health"
  });
});

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/access", accessRouter);
app.use("/api/v1/permanent-passes", permanentPassRouter);
app.use("/api/v1/organizations", organizationRouter);
app.use("/api/v1/kiosks", kioskRouter);
app.use("/api/v1/auth", ownerRouter);
app.use("/api/v1/visitors", visitorRouter);
app.use("/api/v1/passes", visitorPassRouter);
app.use("/api/v1/vehicle-access", vehicleAccessRouter);

app.use(notFoundHandler);

app.use(errorHandler);


