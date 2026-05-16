import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { appointmentSchema, appointmentStatusSchema } from "./appointments.schemas";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

@UseGuards(JwtAuthGuard)
@Controller("appointments")
export class AppointmentsController {
  constructor(@Inject(AppointmentsService) private readonly appointmentsService: AppointmentsService) {}

  @Get()
  list() {
    return this.appointmentsService.list();
  }

  @Get("service-types")
  serviceTypes() {
    return this.appointmentsService.serviceTypes();
  }

  @Post()
  create(@Body(new ZodValidationPipe(appointmentSchema)) body: unknown) {
    return this.appointmentsService.create(body as never);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body(new ZodValidationPipe(appointmentStatusSchema)) body: unknown) {
    return this.appointmentsService.updateStatus(id, (body as { status: never }).status);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.appointmentsService.cancel(id);
  }
}
