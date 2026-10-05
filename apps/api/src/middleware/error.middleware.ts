import type {
  NextFunction,
  Request,
  Response
} from "express";

export function errorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction
): void {
  request.log.error(
    {
      error,
      method: request.method,
      path: request.originalUrl
    },
    "Unhandled application error"
  );

  response.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected system error occurred"
    }
  });
}
