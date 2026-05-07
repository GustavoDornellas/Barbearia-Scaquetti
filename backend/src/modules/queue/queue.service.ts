import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentServiceType, AppointmentStatus, Prisma, QueueStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";
import { z } from "zod";
import { finishQueueSchema, queueSchema } from "./queue.schemas";
import { getTodayRangeInBrazil } from "../../shared/utils/date-range";

type QueueInput = z.infer<typeof queueSchema>;
type FinishQueueInput = z.infer<typeof finishQueueSchema>;

const activeStatuses: QueueStatus[] = [QueueStatus.WAITING, QueueStatus.IN_SERVICE];

@Injectable()
export class QueueService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const todayRange = getTodayRangeInBrazil();

    const [items, lastFinished, finishedToday, appointmentsToday] = await Promise.all([
      this.prisma.queueEntry.findMany({
        where: { status: { in: [QueueStatus.WAITING, QueueStatus.IN_SERVICE] } },
        include: { client: true, barber: true },
        orderBy: [{ position: "asc" }, { scheduledFor: "asc" }]
      }),
      this.prisma.queueEntry.findFirst({
        where: { status: QueueStatus.FINISHED },
        include: { client: true, barber: true },
        orderBy: { finishedAt: "desc" }
      }),
      this.prisma.queueEntry.count({
        where: {
          status: QueueStatus.FINISHED,
          finishedAt: { gte: todayRange.start, lt: todayRange.end }
        }
      }),
      this.prisma.appointment.aggregate({
        where: {
          status: AppointmentStatus.COMPLETED,
          endTime: { gte: todayRange.start, lt: todayRange.end }
        },
        _sum: { price: true }
      })
    ]);

    const visibleItems = lastFinished ? [...items, lastFinished] : items;
    const waitingItems = items.filter((item) => item.status === QueueStatus.WAITING);
    const totalWaitMinutes = items.reduce((sum, item) => {
      if (item.status === QueueStatus.IN_SERVICE) return sum + item.serviceDuration;
      if (item.status === QueueStatus.WAITING) return sum + item.serviceDuration;
      return sum;
    }, 0);

    return {
      items: visibleItems.map((item) => ({
        ...item,
        whatsapp: this.buildWhatsappLink(item.client.phone, item.client.name, item.estimatedMinutes)
      })),
      summary: {
        attendedToday: finishedToday,
        revenueToday: Number(appointmentsToday._sum.price ?? 0),
        averageWaitMinutes: totalWaitMinutes
      }
    };
  }

  async create(payload: QueueInput, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({ where: { id: payload.clientId, isActive: true } });
      if (!client) throw new NotFoundException("Cliente nao encontrado");

      const barberId = await this.resolveQueueBarberId(tx, payload.barberId, actorUserId);

      const activeQueue = await tx.queueEntry.findMany({
        where: { status: { in: activeStatuses } },
        orderBy: [{ scheduledFor: "asc" }, { position: "asc" }]
      });

      const duplicatedClient = activeQueue.find((item) => item.clientId === payload.clientId);
      if (duplicatedClient) {
        throw new BadRequestException("Cliente ja possui atendimento ativo na fila");
      }

      const scheduledFor = this.resolveScheduledFor(payload.scheduledTime);
      const position = activeQueue.length + 1;
      const baseWait = Math.max(0, Math.ceil((scheduledFor.getTime() - Date.now()) / 60000));
      const previousWait = activeQueue
        .filter((item) => item.scheduledFor <= scheduledFor)
        .reduce((sum, item) => sum + item.serviceDuration, 0);
      const estimatedMinutes = baseWait + previousWait;

      const created = await tx.queueEntry.create({
        data: {
          clientId: payload.clientId,
          barberId,
          appointmentId: payload.appointmentId ?? null,
          serviceType: AppointmentServiceType.CORTE,
          serviceDuration: payload.serviceDuration,
          serviceLabel: payload.serviceLabel,
          scheduledFor,
          estimatedMinutes,
          position,
          status: QueueStatus.WAITING
        },
        include: { client: true, barber: true }
      });

      await this.reorderActiveQueue(tx);
      const orderedCreated = await tx.queueEntry.findUnique({
        where: { id: created.id },
        include: { client: true, barber: true }
      });
      if (!orderedCreated) throw new NotFoundException("Item da fila nao encontrado apos ordenar");

      return {
        ...orderedCreated,
        whatsapp: this.buildWhatsappLink(orderedCreated.client.phone, orderedCreated.client.name, orderedCreated.estimatedMinutes)
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateStatus(id: string, status: QueueStatus) {
    if (status === QueueStatus.IN_SERVICE) {
      throw new BadRequestException("Use a acao de chamar proximo cliente");
    }

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUnique({ where: { id }, include: { client: true, barber: true } });
      if (!entry) throw new NotFoundException("Item da fila nao encontrado");

      const updated = await tx.queueEntry.update({
        where: { id },
        data: {
          status,
          startedAt: entry.startedAt,
          finishedAt: status === QueueStatus.FINISHED ? new Date() : entry.finishedAt
        },
        include: { client: true, barber: true }
      });

      if (status === QueueStatus.FINISHED || status === QueueStatus.CANCELLED) {
        await this.reorderActiveQueue(tx);
      }

      return {
        ...updated,
        whatsapp: this.buildWhatsappLink(updated.client.phone, updated.client.name, updated.estimatedMinutes)
      };
    });
  }

  async finish(id: string, payload: FinishQueueInput) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUnique({ where: { id }, include: { client: true, barber: true, appointment: true } });
      if (!entry) throw new NotFoundException("Item da fila nao encontrado");
      if (entry.status !== QueueStatus.IN_SERVICE) {
        throw new BadRequestException("Apenas atendimentos em andamento podem ser finalizados");
      }

      const finishedAt = new Date();
      const appointmentId = await this.upsertCompletedAppointmentFromQueue(tx, entry, payload.amount, finishedAt);
      const shouldUpdateClientTotals = entry.appointment?.status !== AppointmentStatus.COMPLETED;

      const updated = await tx.queueEntry.update({
        where: { id },
        data: {
          status: QueueStatus.FINISHED,
          finishedAt,
          paidAmount: payload.amount,
          appointmentId
        },
        include: { client: true, barber: true }
      });

      if (shouldUpdateClientTotals) {
        await tx.client.update({
          where: { id: entry.clientId },
          data: {
            lastVisitAt: finishedAt,
            totalSpent: { increment: payload.amount }
          }
        });
      }

      await this.reorderActiveQueue(tx);

      return {
        ...updated,
        whatsapp: this.buildWhatsappLink(updated.client.phone, updated.client.name, updated.estimatedMinutes)
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async advance(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUnique({ where: { id }, include: { client: true, barber: true } });
      if (!entry) throw new NotFoundException("Item da fila nao encontrado");
      if (entry.status !== QueueStatus.WAITING) {
        throw new BadRequestException("Apenas clientes aguardando podem ser adiantados");
      }

      await tx.queueEntry.update({
        where: { id },
        data: { scheduledFor: new Date() },
        include: { client: true, barber: true }
      });

      await this.reorderActiveQueue(tx);

      const reordered = await tx.queueEntry.findUnique({
        where: { id },
        include: { client: true, barber: true }
      });
      if (!reordered) throw new NotFoundException("Item da fila nao encontrado apos adiantar");

      return {
        ...reordered,
        whatsapp: this.buildWhatsappLink(
          reordered.client.phone,
          reordered.client.name,
          reordered.estimatedMinutes,
          `Ola, ${reordered.client.name}! Consegui antecipar seu atendimento na Barbearia Scaquetti. Voce consegue vir agora? Tempo estimado: ${reordered.estimatedMinutes} minutos.`
        )
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async callNext() {
    return this.prisma.$transaction(async (tx) => {
      const next = await tx.queueEntry.findFirst({
        where: { status: QueueStatus.WAITING },
        orderBy: { position: "asc" },
        include: { client: true, barber: true }
      });

      if (!next) throw new NotFoundException("Nao ha clientes aguardando");

      if (next.barberId) {
        const activeForBarber = await tx.queueEntry.findFirst({
          where: {
            barberId: next.barberId,
            status: QueueStatus.IN_SERVICE,
            id: { not: next.id }
          }
        });
        if (activeForBarber) {
          throw new BadRequestException("Barbeiro ja possui atendimento em andamento");
        }
      }

      const updated = await tx.queueEntry.update({
        where: { id: next.id },
        data: {
          status: QueueStatus.IN_SERVICE,
          startedAt: new Date(),
          estimatedMinutes: 0
        },
        include: { client: true, barber: true }
      });

      await this.reorderActiveQueue(tx);

      return {
        ...updated,
        whatsapp: this.buildWhatsappLink(updated.client.phone, updated.client.name, updated.estimatedMinutes)
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async remove(id: string) {
    await this.updateStatus(id, QueueStatus.CANCELLED);
    return { message: "Cliente removido da fila" };
  }

  private async reorderActiveQueue(tx: Prisma.TransactionClient) {
    const activeQueue = await tx.queueEntry.findMany({
      where: { status: { in: activeStatuses } },
      orderBy: [{ scheduledFor: "asc" }, { position: "asc" }]
    });

    let accumulatedWait = 0;
    const now = Date.now();
    const inService = activeQueue.find((item) => item.status === QueueStatus.IN_SERVICE);
    const waiting = activeQueue.filter((item) => item.status === QueueStatus.WAITING);
    const orderedQueue = inService ? [inService, ...waiting] : waiting;
    for (const [index, item] of orderedQueue.entries()) {
      const baseWait = item.status === QueueStatus.IN_SERVICE
        ? 0
        : Math.max(0, Math.ceil((item.scheduledFor.getTime() - now) / 60000));
      await tx.queueEntry.update({
        where: { id: item.id },
        data: {
          position: index + 1,
          estimatedMinutes: item.status === QueueStatus.IN_SERVICE ? 0 : baseWait + accumulatedWait
        }
      });

      accumulatedWait += item.serviceDuration;
    }
  }

  private resolveScheduledFor(scheduledTime?: string | null) {
    const scheduledFor = new Date();
    if (!scheduledTime) return scheduledFor;

    const [hours, minutes] = scheduledTime.split(":").map(Number);
    scheduledFor.setHours(hours, minutes, 0, 0);
    return scheduledFor;
  }

  private buildWhatsappLink(phone: string | null, name: string, estimatedMinutes: number, customMessage?: string) {
    const digits = phone?.replace(/\D/g, "") ?? "";
    if (digits.length < 10) return null;
    const normalized = digits.startsWith("55") ? digits : `55${digits}`;
    if (normalized.length < 12) return null;

    const message = encodeURIComponent(customMessage ?? `Ola, ${name}! Seu atendimento na Barbearia Scaquetti esta proximo. Tempo estimado: ${estimatedMinutes} minutos.`);
    return `https://wa.me/${normalized}?text=${message}`;
  }

  private async upsertCompletedAppointmentFromQueue(
    tx: Prisma.TransactionClient,
    entry: Prisma.QueueEntryGetPayload<{ include: { appointment: true } }>,
    amount: number,
    finishedAt: Date
  ) {
    if (entry.appointmentId) {
      await tx.appointment.update({
        where: { id: entry.appointmentId },
        data: {
          status: AppointmentStatus.COMPLETED,
          price: amount,
          endTime: finishedAt,
          estimatedMinutes: entry.serviceDuration,
          notes: entry.serviceLabel
        }
      });
      return entry.appointmentId;
    }

    if (!entry.barberId) {
      throw new BadRequestException("Defina um barbeiro antes de finalizar este atendimento");
    }

    const appointment = await tx.appointment.create({
      data: {
        clientId: entry.clientId,
        barberId: entry.barberId,
        serviceType: entry.serviceType,
        scheduledAt: entry.startedAt ?? entry.scheduledFor,
        endTime: finishedAt,
        estimatedMinutes: entry.serviceDuration,
        price: amount,
        notes: entry.serviceLabel,
        status: AppointmentStatus.COMPLETED
      }
    });

    return appointment.id;
  }

  private async resolveQueueBarberId(tx: Prisma.TransactionClient, requestedBarberId: string | undefined, actorUserId: string) {
    if (requestedBarberId) {
      const barber = await tx.user.findFirst({
        where: {
          id: requestedBarberId,
          role: { in: [UserRole.BARBER, UserRole.ADMIN] }
        }
      });
      if (!barber) throw new NotFoundException("Barbeiro nao encontrado");
      return barber.id;
    }

    const actor = await tx.user.findFirst({
      where: {
        id: actorUserId,
        role: { in: [UserRole.BARBER, UserRole.ADMIN] }
      }
    });
    if (!actor) throw new NotFoundException("Usuario responsavel nao encontrado");
    return actor.id;
  }
}
