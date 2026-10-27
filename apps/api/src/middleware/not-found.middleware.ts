import type { Request, Response } from "express";

export function notFoundHandler(
  _request: Request,
  response: Response
): void {
  response.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "The requested route was not found"
    }
  });
}
