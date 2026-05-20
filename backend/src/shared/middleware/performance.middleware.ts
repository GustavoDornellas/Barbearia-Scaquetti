import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();

    response.on("finish", () => {
      const durationMs = Date.now() - startedAt;

      if (durationMs >= 1000) {
        console.warn(`[slow-request] ${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`);
      }
    });

    next();
  }
}
