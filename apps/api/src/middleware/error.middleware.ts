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
  const errorName = error instanceof Error ? error.name : "UnknownError";
  request.log.error(
    {
      errorName,
      method: request.method,
      path: request.path
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
