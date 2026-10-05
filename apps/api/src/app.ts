import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { allowedOrigins } from "./config/env";
import { errorHandler } from "./middleware/error.middleware";
import { notFoundHandler } from "./middleware/not-found.middleware";
import { healthRouter } from "./routes/health.routes";
import { accessRouter } from "./routes/access.routes";
import { permanentPassRouter } from "./routes/permanent-pass.routes";
import { organizationRouter } from "./routes/organization.routes";
import { kioskRouter } from "./routes/kiosk.routes";
import { ownerRouter } from "./routes/owner.routes";
import { visitorRouter } from "./routes/visitor.routes";

export const app = express();

app.disable("x-powered-by");

app.use(
  pinoHttp({
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
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({ extended: true }));

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

app.use(notFoundHandler);

app.use(errorHandler);


