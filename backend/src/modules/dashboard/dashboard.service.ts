import { Inject, Injectable } from "@nestjs/common";
import { Appointment, AppointmentStatus, ProductSale } from "@prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  addDays,
  getHourInBrazil,
  getLast30DaysRangeInBrazil,
  getLast7DaysRangeInBrazil,
  getTodayRangeInBrazil,
  getWeekdayLabelInBrazil
} from "../../shared/utils/date-range";

type CompletedAppointmentWithClient = Appointment & {
  client: { name: string };
};

type RevenueSummary = {
  total: number;
  count: number;
  quantity?: number;
};

type FlowTrendBucket = {
  label: string;
  count: number;
  percentage: number;
};

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private readonly flowBuckets = [
    { label: "08H", start: 8, end: 9 },
    { label: "10H", start: 10, end: 11 },
    { label: "12H", start: 12, end: 14 },
    { label: "15H", start: 15, end: 17 },
    { label: "18H", start: 18, end: 19 },
    { label: "20H", start: 20, end: 23 }
  ];

  async getFlowTrend() {
    const last30DaysRange = getLast30DaysRangeInBrazil();
    const buckets = await this.buildFlowTrendBuckets(last30DaysRange.start, last30DaysRange.end);
    return this.buildFlowTrendResponse(buckets);
  }

  async getOverview() {
    const todayRange = getTodayRangeInBrazil();
    const last7DaysRange = getLast7DaysRangeInBrazil();
    const last30DaysRange = getLast30DaysRangeInBrazil();

    const [totalClients, completedToday, productSalesToday, weeklyAppointments, weeklyProductSales, popularProducts, recentAppointments, queueCount, flowTrendBuckets] = await Promise.all([
      this.prisma.client.count({ where: { isActive: true } }),
      this.getCompletedAppointmentRevenueSummaryBetween(todayRange.start, todayRange.end),
      this.getProductSalesRevenueSummaryBetween(todayRange.start, todayRange.end),
      this.getCompletedAppointmentsBetween(last7DaysRange.start, last7DaysRange.end),
      this.getProductSalesBetween(last7DaysRange.start, last7DaysRange.end),
      this.getPopularProductsBetween(last30DaysRange.start, last30DaysRange.end),
      this.getRecentCompletedAppointments(5),
      this.prisma.queueEntry.count({
        where: { status: { in: ["WAITING", "CALLED", "IN_SERVICE"] } }
      }),
      this.buildFlowTrendBuckets(last30DaysRange.start, last30DaysRange.end)
    ]);

    const revenueToday = completedToday.total + productSalesToday.total;
    const averageTicket = this.calculateAverageTicket(completedToday);

    return {
      revenueToday,
      totalClients,
      averageTicket,
      productsSoldToday: productSalesToday.quantity ?? 0,
      queueCount,
      weeklyRevenue: this.groupRevenueByWeekday(weeklyAppointments, weeklyProductSales, last7DaysRange.start),
      popularProducts,
      recentActivities: this.buildRecentActivities(recentAppointments),
      flowTrend: this.buildFlowTrendResponse(flowTrendBuckets)
    };
  }

  private async getCompletedAppointmentRevenueSummaryBetween(start: Date, end: Date): Promise<RevenueSummary> {
    const result = await this.prisma.appointment.aggregate({
      where: {
        status: AppointmentStatus.COMPLETED,
        endTime: { gte: start, lt: end }
      },
      _sum: { price: true },
      _count: { _all: true }
    });

    return {
      total: Number(result._sum.price ?? 0),
      count: result._count._all
    };
  }

  private getCompletedAppointmentsBetween(start: Date, end: Date) {
    return this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.COMPLETED,
        endTime: { gte: start, lt: end }
      }
    });
  }

  private getProductSalesBetween(start: Date, end: Date) {
    return this.prisma.productSale.findMany({
      where: {
        createdAt: { gte: start, lt: end }
      }
    });
  }

  private async getProductSalesRevenueSummaryBetween(start: Date, end: Date): Promise<RevenueSummary> {
    const result = await this.prisma.productSale.aggregate({
      where: {
        createdAt: { gte: start, lt: end }
      },
      _sum: { totalPrice: true, quantity: true },
      _count: { _all: true }
    });

    return {
      total: Number(result._sum.totalPrice ?? 0),
      count: result._count._all,
      quantity: result._sum.quantity ?? 0
    };
  }

  private async getPopularProductsBetween(start: Date, end: Date) {
    const groupedSales = await this.prisma.productSale.groupBy({
      by: ["inventoryItemId"],
      where: {
        createdAt: { gte: start, lt: end }
      },
      _sum: {
        quantity: true
      }
    });

    if (groupedSales.length === 0) return [];

    const productIds = groupedSales.map((sale) => sale.inventoryItemId);
    const products = await this.prisma.inventoryItem.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: true }
    });
    const productLabelById = new Map(
      products.map((product) => [product.id, `${product.name} - ${product.category}`])
    );
    const maxQuantity = Math.max(...groupedSales.map((sale) => sale._sum.quantity ?? 0), 0);
    if (maxQuantity === 0) return [];

    return groupedSales
      .map((sale) => {
        const count = sale._sum.quantity ?? 0;

        return {
          label: productLabelById.get(sale.inventoryItemId) ?? "Produto removido",
          count,
          percentage: Math.round((count / maxQuantity) * 100)
        };
      })
      .filter((product) => product.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private getRecentCompletedAppointments(take: number) {
    return this.prisma.appointment.findMany({
      where: { status: AppointmentStatus.COMPLETED },
      include: { client: { select: { name: true } } },
      orderBy: { endTime: "desc" },
      take
    });
  }

  private calculateAverageTicket(completedAppointments: RevenueSummary) {
    if (completedAppointments.count === 0) return 0;
    return completedAppointments.total / completedAppointments.count;
  }

  private groupRevenueByWeekday(
    appointments: Array<Pick<Appointment, "endTime" | "price">>,
    productSales: Array<Pick<ProductSale, "createdAt" | "totalPrice">>,
    weekStart: Date
  ) {
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(weekStart, index);
      const nextDay = addDays(day, 1);
      const appointmentRevenue = appointments
        .filter((appointment) => appointment.endTime >= day && appointment.endTime < nextDay)
        .reduce((sum, appointment) => sum + Number(appointment.price), 0);
      const productRevenue = productSales
        .filter((sale) => sale.createdAt >= day && sale.createdAt < nextDay)
        .reduce((sum, sale) => sum + Number(sale.totalPrice), 0);

      return {
        day: getWeekdayLabelInBrazil(day),
        value: appointmentRevenue + productRevenue
      };
    });
  }

  private buildRecentActivities(appointments: CompletedAppointmentWithClient[]) {
    return appointments.map((appointment) => ({
      id: appointment.id,
      clientName: appointment.client.name,
      serviceLabel: appointment.serviceType,
      price: Number(appointment.price),
      finishedAt: appointment.endTime.toISOString(),
      status: "FINALIZADO"
    }));
  }

  private async buildFlowTrendBuckets(start: Date, end: Date): Promise<FlowTrendBucket[]> {
    const completedAppointments = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.COMPLETED,
        endTime: { gte: start, lt: end }
      },
      select: { endTime: true }
    });

    const counts = this.flowBuckets.map((bucket) => ({
      ...bucket,
      count: completedAppointments.filter((appointment) => {
        const hour = getHourInBrazil(appointment.endTime);
        return hour >= bucket.start && hour <= bucket.end;
      }).length
    }));
    const max = Math.max(...counts.map((bucket) => bucket.count), 0);

    return counts.map(({ label, count }) => ({
      label,
      count,
      percentage: max > 0 ? Math.round((count / max) * 100) : 0
    }));
  }

  private buildFlowTrendResponse(buckets: FlowTrendBucket[]) {
    const peak = buckets.reduce<FlowTrendBucket | null>((currentPeak, bucket) => {
      if (!currentPeak || bucket.count > currentPeak.count) return bucket;
      return currentPeak;
    }, null);

    return {
      buckets,
      peakLabel: peak && peak.count > 0 ? peak.label : null
    };
  }
}
