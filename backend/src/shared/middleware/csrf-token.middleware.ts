import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class CsrfTokenMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (typeof req.csrfToken === "function") {
      res.setHeader("X-CSRF-Token", req.csrfToken());
    }

    next();
  }
}

