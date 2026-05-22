import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentServiceType, AppointmentStatus, Prisma, QueueStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";
import { z } from "zod";
import { finishQueueSchema, queueSchema } from "./queue.schemas";
import { getTodayRangeInBrazil } from "../../shared/utils/date-range";

type QueueInput = z.infer<typeof queueSchema>;
type FinishQueueInput = z.infer<typeof finishQueueSchema>;
type QueueEntryWithRelations = Prisma.QueueEntryGetPayload<{ include: { client: true; barber: true } }>;

const activeStatuses: QueueStatus[] = [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE];

@Injectable()
export class QueueService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list() {
    const todayRange = getTodayRangeInBrazil();

    const [items, finishedToday, appointmentsToday, productSalesToday] = await Promise.all([
      this.prisma.queueEntry.findMany({
        where: { status: { in: activeStatuses } },
        include: { client: true, barber: true },
        orderBy: [{ position: "asc" }, { scheduledFor: "asc" }]
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
      }),
      this.prisma.productSale.aggregate({
        where: {
          createdAt: { gte: todayRange.start, lt: todayRange.end }
        },
        _sum: { totalPrice: true }
      })
    ]);

    const now = new Date();
    const activeInServiceItems = items.filter((item) => item.status === QueueStatus.IN_SERVICE);
    const calledItems = items.filter((item) => item.status === QueueStatus.CALLED);
    const waitingItems = items.filter((item) => item.status === QueueStatus.WAITING);
    const remainingInServiceMinutes = activeInServiceItems.reduce((sum, item) => sum + this.calculateServiceProgress(item, now).remainingMinutes, 0);
    const pendingWaitMinutes = [...calledItems, ...waitingItems].reduce((sum, item) => sum + item.serviceDuration, 0);
    const totalWaitMinutes = remainingInServiceMinutes + pendingWaitMinutes;
    const canCallNext = this.canCallNextFromActiveItems(activeInServiceItems, waitingItems, calledItems, now);

    const result = {
      items: items.map((item) => this.buildQueueItemResponse(item, now)),
      summary: {
        attendedToday: finishedToday,
        revenueToday: Number(appointmentsToday._sum.price ?? 0) + Number(productSalesToday._sum.totalPrice ?? 0),
        averageWaitMinutes: totalWaitMinutes,
        canCallNext,
        callNextAvailableInMinutes: this.getCallNextAvailableInMinutes(activeInServiceItems, waitingItems, calledItems, now)
      }
    };

    return result;
  }

  async create(payload: QueueInput, actorUserId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
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
      const position = activeQueue.filter((item) => item.status === QueueStatus.WAITING).length + 1;
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

      return this.buildQueueItemResponse(orderedCreated);
    });
    return result;
  }

  async updateStatus(id: string, status: QueueStatus) {
    if (status === QueueStatus.CALLED || status === QueueStatus.IN_SERVICE) {
      throw new BadRequestException("Use a acao correta da fila para chamar ou iniciar atendimento");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUnique({ where: { id }, include: { client: true, barber: true } });
      if (!entry) throw new NotFoundException("Item da fila nao encontrado");

      const updated = await tx.queueEntry.update({
        where: { id },
        data: {
          status,
          startedAt: entry.startedAt,
          calledAt: entry.calledAt,
          finishedAt: status === QueueStatus.FINISHED ? new Date() : entry.finishedAt
        },
        include: { client: true, barber: true }
      });

      if (status === QueueStatus.FINISHED || status === QueueStatus.CANCELLED) {
        await this.reorderActiveQueue(tx);
      }

      return this.buildQueueItemResponse(updated);
    });
    return result;
  }

  async finish(id: string, payload: FinishQueueInput) {
    const result = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUnique({ where: { id }, include: { client: true, barber: true, appointment: true } });
      if (!entry) throw new NotFoundException("Item da fila nao encontrado");
      if (entry.status !== QueueStatus.IN_SERVICE) {
        throw new BadRequestException("Apenas atendimentos em andamento podem ser finalizados");
      }
      console.log(`[queue:finish:debug] serviceLabel="${entry.serviceLabel}"`);
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

      return this.buildQueueItemResponse(updated);
    });
    return result;
  }

  async advance(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
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

      return this.buildQueueItemResponse(
        reordered,
        new Date(),
        `Ola, ${reordered.client.name}! Consegui antecipar seu atendimento na Barbearia Scaquetti. Voce consegue vir agora? Tempo estimado: ${reordered.estimatedMinutes} minutos.`
      );
    });
    return result;
  }

  async callNext() {
    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const activeInServiceItems = await tx.queueEntry.findMany({
        where: { status: QueueStatus.IN_SERVICE },
        orderBy: [{ startedAt: "asc" }, { position: "asc" }],
        include: { client: true, barber: true }
      });
      const activeCalledItems = await tx.queueEntry.findMany({
        where: { status: QueueStatus.CALLED },
        orderBy: [{ calledAt: "asc" }, { position: "asc" }],
        include: { client: true, barber: true }
      });
      const next = await tx.queueEntry.findFirst({
        where: { status: QueueStatus.WAITING },
        orderBy: { position: "asc" },
        include: { client: true, barber: true }
      });

      if (!next) throw new NotFoundException("Nao ha clientes aguardando");
      if (activeCalledItems.length > 0) {
        throw new BadRequestException("Ja existe um cliente chamado aguardando atendimento.");
      }

      if (!this.canCallNextFromActiveItems(activeInServiceItems, [next], activeCalledItems, now)) {
        throw new BadRequestException("Chame o proximo cliente quando faltarem 10 minutos ou menos para terminar o atendimento atual");
      }

      const updated = await tx.queueEntry.update({
        where: { id: next.id },
        data: {
          status: QueueStatus.CALLED,
          calledAt: now,
          estimatedMinutes: this.calculateCalledWaitMinutes(activeInServiceItems, now)
        },
        include: { client: true, barber: true }
      });

      await this.reorderActiveQueue(tx);

      return this.buildQueueItemResponse(
        updated,
        now,
        `Ola, ${updated.client.name}! Seu atendimento na Barbearia Scaquetti sera em aproximadamente 10 minutos. Pode se preparar para vir.`
      );
    });
    return result;
  }

  async startService(id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.queueEntry.findUnique({ where: { id }, include: { client: true, barber: true } });
      if (!entry) throw new NotFoundException("Item da fila nao encontrado");
      if (entry.status !== QueueStatus.CALLED && entry.status !== QueueStatus.WAITING) {
        throw new BadRequestException("Apenas clientes chamados ou aguardando podem iniciar atendimento");
      }

      const activeInService = await tx.queueEntry.findFirst({
        where: { status: QueueStatus.IN_SERVICE, id: { not: id } }
      });
      if (activeInService) {
        throw new BadRequestException("Ja existe um atendimento em andamento.");
      }

      if (entry.status === QueueStatus.WAITING) {
        const activeCalled = await tx.queueEntry.findFirst({
          where: { status: QueueStatus.CALLED, id: { not: id } }
        });
        if (activeCalled) {
          throw new BadRequestException("Ja existe um cliente chamado aguardando atendimento.");
        }
      }

      const now = new Date();
      const updated = await tx.queueEntry.update({
        where: { id },
        data: {
          status: QueueStatus.IN_SERVICE,
          startedAt: now,
          calledAt: entry.calledAt ?? now,
          estimatedMinutes: 0
        },
        include: { client: true, barber: true }
      });

      await this.reorderActiveQueue(tx);

      return this.buildQueueItemResponse(updated, now);
    });
    return result;
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
    const inService = activeQueue.filter((item) => item.status === QueueStatus.IN_SERVICE);
    const called = activeQueue.filter((item) => item.status === QueueStatus.CALLED);
    const waiting = activeQueue.filter((item) => item.status === QueueStatus.WAITING);

    for (const item of [...inService, ...called]) {
      const progress = this.calculateServiceProgress(item, new Date(now));
      accumulatedWait += item.status === QueueStatus.IN_SERVICE ? progress.remainingMinutes : item.serviceDuration;
    }

    // Fase 1: calcula todas as posições e tempos em JS puro (sem IO)
    const updates: Array<{ id: string; position: number; estimatedMinutes: number }> = [];
    for (const [index, item] of waiting.entries()) {
      const baseWait = Math.max(0, Math.ceil((item.scheduledFor.getTime() - now) / 60000));
      const estimatedMinutes = baseWait + accumulatedWait;
      updates.push({ id: item.id, position: index + 1, estimatedMinutes });
      accumulatedWait += item.serviceDuration;
    }


    // Fase 2: dispara todos os UPDATEs em paralelo — 1 round-trip independente do tamanho da fila
    if (updates.length > 0) {
      await Promise.all(
        updates.map(({ id, position, estimatedMinutes }) =>
          tx.queueEntry.update({
            where: { id },
            data: { position, estimatedMinutes }
          })
        )
      );
    }

  }

  private buildQueueItemResponse(item: QueueEntryWithRelations, now = new Date(), customWhatsappMessage?: string) {
    const progress = this.calculateServiceProgress(item, now);

    return {
      ...item,
      ...progress,
      canCallNext: item.status === QueueStatus.IN_SERVICE && progress.remainingMinutes <= 10,
      whatsapp: this.buildWhatsappLink(item.client.phone, item.client.name, item.estimatedMinutes, customWhatsappMessage)
    };
  }

  private calculateServiceProgress(item: Pick<QueueEntryWithRelations, "status" | "startedAt" | "serviceDuration">, now = new Date()) {
    if (item.status !== QueueStatus.IN_SERVICE || !item.startedAt) {
      return {
        elapsedMinutes: 0,
        remainingMinutes: 0
      };
    }

    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - item.startedAt.getTime()) / 60000));
    const remainingMinutes = Math.max(0, item.serviceDuration - elapsedMinutes);

    return {
      elapsedMinutes,
      remainingMinutes
    };
  }

  private canCallNextFromActiveItems(
    inServiceItems: QueueEntryWithRelations[],
    waitingItems: QueueEntryWithRelations[],
    calledItems: QueueEntryWithRelations[],
    now = new Date()
  ) {
    if (waitingItems.length === 0) return false;
    if (calledItems.length > 0) return false;
    if (inServiceItems.length === 0) return true;
    return inServiceItems.some((item) => this.calculateServiceProgress(item, now).remainingMinutes <= 10);
  }

  private getCallNextAvailableInMinutes(
    inServiceItems: QueueEntryWithRelations[],
    waitingItems: QueueEntryWithRelations[],
    calledItems: QueueEntryWithRelations[],
    now = new Date()
  ) {
    if (waitingItems.length === 0 || calledItems.length > 0) return null;
    if (inServiceItems.length === 0) return 0;

    const nearestRemaining = Math.min(...inServiceItems.map((item) => this.calculateServiceProgress(item, now).remainingMinutes));
    return Math.max(0, nearestRemaining - 10);
  }

  private calculateCalledWaitMinutes(inServiceItems: QueueEntryWithRelations[], now = new Date()) {
    if (inServiceItems.length === 0) return 0;
    return Math.min(...inServiceItems.map((item) => this.calculateServiceProgress(item, now).remainingMinutes));
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
