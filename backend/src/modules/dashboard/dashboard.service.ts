import { Inject, Injectable } from "@nestjs/common";
import { Appointment, AppointmentStatus, ProductSale } from "@prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  addDays,
  getHourInBrazil,
  getLast30DaysRangeInBrazil,
  getLast7DaysRangeInBrazil,
  getTodayRangeInBrazil,
  toBrazilDate,
  getWeekdayLabelInBrazil
} from "../../shared/utils/date-range";

type CompletedAppointmentWithClient = Appointment & {
  client: { name: string };
  queueEntry?: { serviceLabel: string } | null;
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
    { label: "12H", start: 12, end: 13 },
    { label: "14H", start: 14, end: 15 },
    { label: "16H", start: 16, end: 17 },
    { label: "18H", start: 18, end: 19 },
    { label: "20H", start: 20, end: 21 }
  ];

  async getClosingHistory(months = 1) {
    const now = new Date();
    const start = new Date(`${now.getFullYear()}-${String(now.getMonth() + 1 - months + 1).padStart(2, "0")}-01T00:00:00-03:00`);
    // Busca todos os appointments dos últimos N meses agrupados por dia
    const appointments = await this.prisma.appointment.findMany({
      where: { status: AppointmentStatus.COMPLETED, endTime: { gte: start } },
      select: { endTime: true, price: true }
    });
    const productSales = await this.prisma.productSale.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, totalPrice: true, quantity: true }
    });

    // Agrupa por data no fuso de Brasília
    const dayMap = new Map<string, { appointments: number; revenueAppointments: number; revenueProducts: number; productsSold: number }>();

    for (const a of appointments) {
      const day = toBrazilDate(a.endTime).toISOString().slice(0, 10);
      const existing = dayMap.get(day) ?? { appointments: 0, revenueAppointments: 0, revenueProducts: 0, productsSold: 0 };
      dayMap.set(day, { ...existing, appointments: existing.appointments + 1, revenueAppointments: existing.revenueAppointments + Number(a.price) });
    }

    for (const s of productSales) {
      const day = toBrazilDate(s.createdAt).toISOString().slice(0, 10);
      const existing = dayMap.get(day) ?? { appointments: 0, revenueAppointments: 0, revenueProducts: 0, productsSold: 0 };
      dayMap.set(day, { ...existing, revenueProducts: existing.revenueProducts + Number(s.totalPrice), productsSold: existing.productsSold + s.quantity });
    }

    const days = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        dateFormatted: new Date(`${date}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        ...data,
        total: data.revenueAppointments + data.revenueProducts
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return { days };
  }

  async getMonthlyReport(year: number, month: number) {
    const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00-03:00`);
    const end = new Date(month === 12 ? `${year + 1}-01-01T00:00:00-03:00` : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00-03:00`);

    const [appointments, productSales] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { status: AppointmentStatus.COMPLETED, endTime: { gte: start, lt: end } },
        include: { queueEntry: { select: { serviceLabel: true } } },
        select: { endTime: true, price: true, notes: true, serviceType: true, queueEntry: true }
      }),
      this.prisma.productSale.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { createdAt: true, totalPrice: true, quantity: true }
      })
    ]);

    const revenueAppointments = appointments.reduce((sum, a) => sum + Number(a.price), 0);
    const revenueProducts = productSales.reduce((sum, s) => sum + Number(s.totalPrice), 0);
    const totalRevenue = revenueAppointments + revenueProducts;
    const averageTicket = appointments.length > 0 ? revenueAppointments / appointments.length : 0;

    // Dias trabalhados
    const workedDays = new Set(appointments.map((a) => toBrazilDate(a.endTime).toISOString().slice(0, 10))).size;

    // Melhor e pior dia
    const dayRevMap = new Map<string, number>();
    for (const a of appointments) {
      const day = toBrazilDate(a.endTime).toISOString().slice(0, 10);
      dayRevMap.set(day, (dayRevMap.get(day) ?? 0) + Number(a.price));
    }
    const dayEntries = Array.from(dayRevMap.entries());
    const bestDay = dayEntries.sort((a, b) => b[1] - a[1])[0];
    const worstDay = dayEntries.sort((a, b) => a[1] - b[1])[0];

    // Serviços mais realizados
    const serviceMap = new Map<string, number>();
    for (const a of appointments) {
      const label = a.queueEntry?.serviceLabel ?? a.notes ?? a.serviceType;
      serviceMap.set(label, (serviceMap.get(label) ?? 0) + 1);
    }
    const topServices = Array.from(serviceMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const monthName = new Date(`${year}-${String(month).padStart(2, "0")}-15`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

    return {
      monthName,
      year,
      month,
      summary: {
        workedDays,
        totalClients: appointments.length,
        averageTicket,
        revenueAppointments,
        revenueProducts,
        totalRevenue
      },
      bestDay: bestDay ? { date: new Date(`${bestDay[0]}T12:00:00-03:00`).toLocaleDateString("pt-BR"), revenue: bestDay[1] } : null,
      worstDay: worstDay && worstDay[0] !== bestDay?.[0] ? { date: new Date(`${worstDay[0]}T12:00:00-03:00`).toLocaleDateString("pt-BR"), revenue: worstDay[1] } : null,
      topServices
    };
  }

  async getCashClosing(dateStr?: string) {
    const reference = dateStr ? new Date(`${dateStr}T12:00:00-03:00`) : new Date();
    const range = getTodayRangeInBrazil(reference);

    const [appointments, productSales] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          status: AppointmentStatus.COMPLETED,
          endTime: { gte: range.start, lt: range.end }
        },
        include: {
          client: { select: { name: true } },
          queueEntry: { select: { serviceLabel: true } }
        },
        orderBy: { endTime: "asc" }
      }),
      this.prisma.productSale.findMany({
        where: {
          createdAt: { gte: range.start, lt: range.end }
        },
        include: {
          inventoryItem: { select: { name: true, category: true } }
        },
        orderBy: { createdAt: "asc" }
      })
    ]);

    const totalAppointments = appointments.reduce((sum, a) => sum + Number(a.price), 0);
    const totalProducts = productSales.reduce((sum, s) => sum + Number(s.totalPrice), 0);

    return {
      date: dateStr ?? new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      summary: {
        totalAppointments: appointments.length,
        revenueAppointments: totalAppointments,
        totalProductsSold: productSales.reduce((sum, s) => sum + s.quantity, 0),
        revenueProducts: totalProducts,
        totalRevenue: totalAppointments + totalProducts
      },
      appointments: appointments.map((a) => ({
        time: a.endTime.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
        client: a.client.name,
        service: a.queueEntry?.serviceLabel ?? a.notes ?? a.serviceType,
        price: Number(a.price)
      })),
      products: productSales.map((s) => ({
        name: s.inventoryItem.name,
        brand: s.inventoryItem.category,
        quantity: s.quantity,
        unitPrice: Number(s.unitPrice),
        total: Number(s.totalPrice)
      }))
    };
  }

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
      include: {
        client: { select: { name: true } },
        queueEntry: { select: { serviceLabel: true } }
      },
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
      serviceLabel: appointment.notes ?? appointment.queueEntry?.serviceLabel ?? appointment.serviceType,
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
