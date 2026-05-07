import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getOverview() {
    return this.dashboardService.getOverview();
  }
}
