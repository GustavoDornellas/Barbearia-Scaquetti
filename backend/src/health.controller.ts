import { Controller, Get, Inject } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "./database/prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @SkipThrottle({ default: true })
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      database: "ok"
    };
  }
}
