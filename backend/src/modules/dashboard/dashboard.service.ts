import { Injectable } from "@nestjs/common";
import { Appointment, AppointmentStatus } from "@prisma/client";
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

type FlowTrendBucket = {
  label: string;
  count: number;
  percentage: number;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly flowBuckets = [
    { label: "08H", start: 8, end: 9 },
    { label: "10H", start: 10, end: 11 },
    { label: "12H", start: 12, end: 14 },
    { label: "15H", start: 15, end: 17 },
    { label: "18H", start: 18, end: 19 },
    { label: "20H", start: 20, end: 23 }
  ];

  async getOverview() {
    const todayRange = getTodayRangeInBrazil();
    const last7DaysRange = getLast7DaysRangeInBrazil();
    const last30DaysRange = getLast30DaysRangeInBrazil();

    const [totalClients, completedToday, weeklyAppointments, popularAppointments, recentAppointments, queueCount, flowTrendBuckets] = await Promise.all([
      this.prisma.client.count({ where: { isActive: true } }),
      this.getCompletedAppointmentsBetween(todayRange.start, todayRange.end),
      this.getCompletedAppointmentsBetween(last7DaysRange.start, last7DaysRange.end),
      this.getCompletedAppointmentsBetween(last30DaysRange.start, last30DaysRange.end),
      this.getRecentCompletedAppointments(5),
      this.prisma.queueEntry.count({
        where: { status: { in: ["WAITING", "IN_SERVICE"] } }
      }),
      this.buildFlowTrendBuckets(last30DaysRange.start, last30DaysRange.end)
    ]);

    const revenueToday = this.sumAppointmentRevenue(completedToday);
    const averageTicket = this.calculateAverageTicket(completedToday);

    return {
      revenueToday,
      totalClients,
      averageTicket,
      queueCount,
      weeklyRevenue: this.groupRevenueByWeekday(weeklyAppointments, last7DaysRange.start),
      popularServices: this.buildPopularServices(popularAppointments),
      recentActivities: this.buildRecentActivities(recentAppointments),
      flowTrend: this.buildFlowTrendResponse(flowTrendBuckets)
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

  private getRecentCompletedAppointments(take: number) {
    return this.prisma.appointment.findMany({
      where: { status: AppointmentStatus.COMPLETED },
      include: { client: { select: { name: true } } },
      orderBy: { endTime: "desc" },
      take
    });
  }

  private sumAppointmentRevenue(appointments: Array<Pick<Appointment, "price">>) {
    return appointments.reduce((sum, appointment) => sum + Number(appointment.price), 0);
  }

  private calculateAverageTicket(appointments: Array<Pick<Appointment, "price">>) {
    if (appointments.length === 0) return 0;
    return this.sumAppointmentRevenue(appointments) / appointments.length;
  }

  private groupRevenueByWeekday(appointments: Array<Pick<Appointment, "endTime" | "price">>, weekStart: Date) {
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(weekStart, index);
      const nextDay = addDays(day, 1);
      const value = appointments
        .filter((appointment) => appointment.endTime >= day && appointment.endTime < nextDay)
        .reduce((sum, appointment) => sum + Number(appointment.price), 0);

      return {
        day: getWeekdayLabelInBrazil(day),
        value
      };
    });
  }

  private buildPopularServices(appointments: Array<Pick<Appointment, "serviceType">>) {
    if (appointments.length === 0) return [];

    const totals = appointments.reduce<Record<string, number>>((acc, appointment) => {
      acc[appointment.serviceType] = (acc[appointment.serviceType] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(totals)
      .map(([label, count]) => ({
        label,
        count,
        percentage: Math.round((count / appointments.length) * 100)
      }))
      .sort((a, b) => b.count - a.count);
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
