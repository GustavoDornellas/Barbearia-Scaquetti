import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import csurf from "csurf";
import { ResponseInterceptor } from "./shared/interceptors/response.interceptor";
import { SanitizationMiddleware } from "./shared/middleware/sanitization.middleware";
import { HttpExceptionFilter } from "./shared/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction) {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }

  app.enableCors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem nao permitida pelo CORS"));
    },
    credentials: true
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: false
    })
  );
  app.use(cookieParser());
  app.use(new SanitizationMiddleware().use);
  app.use(
    csurf({
      cookie: {
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction
      }
    })
  );
  app.setGlobalPrefix("v1");
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(Number(process.env.PORT ?? 3001));
}

bootstrap();
