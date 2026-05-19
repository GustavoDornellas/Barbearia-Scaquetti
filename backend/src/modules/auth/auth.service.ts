import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import { PrismaService } from "../../database/prisma/prisma.service";
import { LoginInput } from "./auth.schemas";

function durationToMs(value: `${number}${"s" | "m" | "h" | "d"}`) {
  const amount = Number(value.slice(0, -1));
  const unit = value.slice(-1);
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit as keyof typeof multipliers];
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService
  ) {}

  async login(payload: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) throw new UnauthorizedException("Credenciais invalidas");

    const passwordMatches = await bcrypt.compare(payload.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException("Credenciais invalidas");

    return this.issueTokens(user.id, user.email, user.role, user.name);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; email: string; role: UserRole; name: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET as string
      });

      const persisted = await this.prisma.refreshToken.findFirst({
        where: {
          userId: payload.sub,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: "desc" }
      });

      if (!persisted) throw new ForbiddenException("Refresh token invalido");

      const matches = await bcrypt.compare(refreshToken, persisted.tokenHash);
      if (!matches) throw new ForbiddenException("Refresh token invalido");

      await this.prisma.refreshToken.delete({ where: { id: persisted.id } });

      return this.issueTokens(payload.sub, payload.email, payload.role, payload.name);
    } catch {
      throw new ForbiddenException("Refresh token invalido");
    }
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: "Sessao encerrada" };
  }

  private async issueTokens(userId: string, email: string, role: UserRole, name: string) {
    const accessExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ?? "15m") as `${number}${"s" | "m" | "h" | "d"}`;
    const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ?? "7d") as `${number}${"s" | "m" | "h" | "d"}`;

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, role, name },
      {
        secret: process.env.JWT_ACCESS_SECRET as string,
        expiresIn: accessExpiresIn
      }
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email, role, name },
      {
        secret: process.env.JWT_REFRESH_SECRET as string,
        expiresIn: refreshExpiresIn
      }
    );

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const accessMaxAge = durationToMs(accessExpiresIn);
    const refreshMaxAge = durationToMs(refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshMaxAge)
      }
    });

    return {
      accessToken,
      refreshToken,
      accessMaxAge,
      refreshMaxAge,
      user: {
        id: userId,
        email,
        role,
        name
      }
    };
  }
}
