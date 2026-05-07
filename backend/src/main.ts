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
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

  app.enableCors({
    origin: frontendUrl,
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

  await app.listen(Number(process.env.PORT));
}

bootstrap();
