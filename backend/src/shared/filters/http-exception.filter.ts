import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    const message = status === HttpStatus.TOO_MANY_REQUESTS
      ? "Muitas tentativas em pouco tempo. Aguarde alguns segundos e tente novamente."
      :
      typeof exceptionResponse === "object" && exceptionResponse && "message" in exceptionResponse
        ? (exceptionResponse as { message: string | string[] }).message
        : exception instanceof Error
          ? exception.message
          : "Erro interno";

    response.status(status).json({
      success: false,
      error: Array.isArray(message) ? message.join(", ") : message
    });
  }
}
