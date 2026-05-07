import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ClientsService } from "./clients.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { clientSchema } from "./clients.schemas";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";

@UseGuards(JwtAuthGuard)
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(@Query("search") search = "", @Query("page") page = "1") {
    return this.clientsService.list(search, Number(page));
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.clientsService.detail(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(clientSchema)) body: unknown) {
    return this.clientsService.create(body as never);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(clientSchema)) body: unknown) {
    return this.clientsService.update(id, body as never);
  }

  @Put(":id")
  replace(@Param("id") id: string, @Body(new ZodValidationPipe(clientSchema)) body: unknown) {
    return this.clientsService.update(id, body as never);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.clientsService.remove(id);
  }
}
