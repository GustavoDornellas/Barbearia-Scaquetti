import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { Roles } from "../../shared/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { inventoryMovementSchema, inventorySchema } from "./inventory.schemas";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { RolesGuard } from "../../shared/guards/roles.guard";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list() {
    return this.inventoryService.list();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(inventorySchema)) body: unknown) {
    return this.inventoryService.create(body as never);
  }

  @Roles(UserRole.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(inventorySchema)) body: unknown) {
    return this.inventoryService.update(id, body as never);
  }

  @Roles(UserRole.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.inventoryService.remove(id);
  }

  @Roles(UserRole.ADMIN)
  @Post(":id/movements")
  move(@Param("id") id: string, @Body(new ZodValidationPipe(inventoryMovementSchema)) body: unknown) {
    return this.inventoryService.move(id, body as never);
  }
}
