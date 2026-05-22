import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { CsrfService } from "../services/csrf.service";

@Injectable()
export class CsrfTokenMiddleware implements NestMiddleware {
  constructor(private readonly csrfService: CsrfService) {}

  use(_req: Request, res: Response, next: NextFunction) {
    res.setHeader("X-CSRF-Token", this.csrfService.generate());
    next();
  }
}
