import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./database/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { QueueModule } from "./modules/queue/queue.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { UsersModule } from "./modules/users/users.module";
import { CsrfTokenMiddleware } from "./shared/middleware/csrf-token.middleware";
import { validateEnv } from "./shared/config/env.validation";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 300),
        blockDuration: 10000
      }
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    QueueModule,
    AppointmentsModule,
    InventoryModule,
    DashboardModule
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfTokenMiddleware).forRoutes("*");
  }
}
