import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.status(200).json({
    success: true,
    service: "SMARTPASS360 API",
    version: "1.0.0",
    status: "ONLINE",
    environment: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString()
  });
});