import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { QueueStatus } from "@prisma/client";
import { Request } from "express";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { finishQueueSchema, queueSchema, queueStatusSchema } from "./queue.schemas";
import { QueueService } from "./queue.service";

type AuthenticatedRequest = Request & {
  user: { sub: string };
};

@UseGuards(JwtAuthGuard)
@Controller("queue")
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get()
  list() {
    return this.queueService.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(queueSchema)) body: unknown, @Req() request: AuthenticatedRequest) {
    return this.queueService.create(body as never, request.user.sub);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body(new ZodValidationPipe(queueStatusSchema)) body: unknown) {
    return this.queueService.updateStatus(id, (body as { status: QueueStatus }).status);
  }

  @Post(":id/finish")
  finish(@Param("id") id: string, @Body(new ZodValidationPipe(finishQueueSchema)) body: unknown) {
    return this.queueService.finish(id, body as never);
  }

  @Post(":id/advance")
  advance(@Param("id") id: string) {
    return this.queueService.advance(id);
  }

  @Post("call-next")
  callNext() {
    return this.queueService.callNext();
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.queueService.remove(id);
  }
}
