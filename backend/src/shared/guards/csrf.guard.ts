import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { CsrfService } from "../services/csrf.service";
import { Request } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrfService: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Métodos seguros não precisam de CSRF
    if (SAFE_METHODS.has(request.method)) return true;

    const token =
      request.headers["x-csrf-token"] as string |undefined ??
      request.headers["x-xsrf-token"] as string | undefined;

    if (!token || !this.csrfService.validate(token)) {
      throw new ForbiddenException("invalid csrf token");
    }

    return true;
  }
}
