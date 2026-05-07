import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import xss from "xss";

function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    return xss(value.trim());
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, sanitize(nested)]));
  }

  return value;
}

@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (req.body) req.body = sanitize(req.body);
    if (req.query) {
      const sanitizedQuery = sanitize(req.query) as Record<string, unknown>;
      Object.entries(sanitizedQuery).forEach(([key, value]) => {
        (req.query as Record<string, unknown>)[key] = value;
      });
    }
    next();
  }
}
