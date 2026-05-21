import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get()
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get("flow-trend")
  getFlowTrend() {
    return this.dashboardService.getFlowTrend();
  }
}
