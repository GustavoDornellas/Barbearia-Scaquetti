import { Controller, Get, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("barbers")
  listBarbers() {
    return this.usersService.listBarbers();
  }
}

