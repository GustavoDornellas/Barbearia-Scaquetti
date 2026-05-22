import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
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

  @Get("cash-closing")
  getCashClosing(@Query("date") date?: string) {
    return this.dashboardService.getCashClosing(date);
  }

  @Get("closing-history")
  getClosingHistory(@Query("months") months?: string) {
    return this.dashboardService.getClosingHistory(Number(months ?? 1));
  }

  @Get("monthly-report")
  getMonthlyReport(@Query("year") year?: string, @Query("month") month?: string) {
    return this.dashboardService.getMonthlyReport(
      Number(year ?? new Date().getFullYear()),
      Number(month ?? new Date().getMonth() + 1)
    );
  }
}
