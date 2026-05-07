import { Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, Prisma, QueueStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";
import { ClientInput } from "./clients.schemas";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search = "", page = 1, pageSize = 5) {
    const where: Prisma.ClientWhereInput = {
      isActive: true,
      ...(search
        ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } }
          ]
        }
        : {})
    };

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [items, total, attendedThisMonth, revenueFromClients] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.client.count({ where }),
      this.prisma.client.count({
        where: {
          isActive: true,
          OR: [
            { lastVisitAt: { gte: monthStart } },
            { queueEntries: { some: { status: QueueStatus.FINISHED, finishedAt: { gte: monthStart } } } },
            { appointments: { some: { status: AppointmentStatus.COMPLETED, scheduledAt: { gte: monthStart } } } }
          ]
        }
      }),
      this.prisma.client.aggregate({
        where: { isActive: true },
        _sum: { totalSpent: true }
      })
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      summary: {
        totalClients: total,
        attendedThisMonth,
        revenueFromClients: Number(revenueFromClients._sum.totalSpent ?? 0)
      }
    };
  }

  async create(payload: ClientInput) {
    return this.prisma.client.create({
      data: {
        ...payload,
        email: payload.email || null
      }
    });
  }

  async update(id: string, payload: ClientInput) {
    await this.ensureExists(id);

    return this.prisma.client.update({
      where: { id },
      data: {
        ...payload,
        email: payload.email || null
      }
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.client.update({
      where: { id },
      data: { isActive: false }
    });
    return { message: "Cliente removido" };
  }

  async detail(id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, isActive: true },
      include: {
        appointments: {
          include: { barber: true },
          orderBy: { scheduledAt: "desc" }
        }
      }
    });

    if (!client) throw new NotFoundException("Cliente nao encontrado");

    const completed = client?.appointments.filter((item) => item.status === AppointmentStatus.COMPLETED) ?? [];
    const totalSpent = completed.reduce((sum, item) => sum + Number(item.price), 0);

    return {
      ...client,
      history: completed,
      totalSpent
    };
  }

  private async ensureExists(id: string) {
    const client = await this.prisma.client.findFirst({ where: { id, isActive: true } });
    if (!client) throw new NotFoundException("Cliente nao encontrado");
    return client;
  }
}
