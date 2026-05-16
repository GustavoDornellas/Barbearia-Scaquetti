import { Body, Controller, ForbiddenException, Get, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { loginSchema } from "./auth.schemas";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { CurrentUser } from "../../shared/decorators/current-user.decorator";
import { UserRole } from "@prisma/client";
import { SkipThrottle, Throttle } from "@nestjs/throttler";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60000, blockDuration: 30000 } })
  @Post("login")
  async login(@Body(new ZodValidationPipe(loginSchema)) body: unknown, @Res({ passthrough: true }) response: Response) {
    const payload = await this.authService.login(body as never);
    this.attachAuthCookies(response, payload.accessToken, payload.refreshToken, payload.accessMaxAge);
    return { user: payload.user };
  }

  @Post("refresh")
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = request.cookies?.refreshToken;
    if (!token) {
      throw new ForbiddenException("Refresh token ausente");
    }

    const payload = await this.authService.refresh(token);
    this.attachAuthCookies(response, payload.accessToken, payload.refreshToken, payload.accessMaxAge);
    return { user: payload.user };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: { sub: string; email: string; name: string; role: UserRole }) {
    return {
      user: {
        id: user.sub,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@CurrentUser() user: { sub: string }, @Res({ passthrough: true }) response: Response) {
    this.clearAuthCookies(response);
    return this.authService.logout(user.sub);
  }

  @SkipThrottle({ default: true })
  @Get("csrf-token")
  getCsrfToken(@Req() request: Request) {
    return {
      csrfToken: request.csrfToken?.()
    };
  }

  private attachAuthCookies(response: Response, accessToken: string, refreshToken: string, accessMaxAge = 15 * 60 * 1000) {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
      secure: isProduction,
      path: "/",
    };

    response.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: accessMaxAge
    });

    response.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }

  private clearAuthCookies(response: Response) {
    const isProduction = process.env.NODE_ENV === "production";
    const options = {
      httpOnly: true,
      sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
      secure: isProduction,
      path: "/"
    };

    response.clearCookie("accessToken", options);
    response.clearCookie("refreshToken", options);
  }
}
