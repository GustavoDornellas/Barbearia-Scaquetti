import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentServiceType, AppointmentStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";
import { serviceCatalog } from "../../shared/utils/service-catalog";
import { z } from "zod";
import { appointmentSchema } from "./appointments.schemas";

type AppointmentInput = z.infer<typeof appointmentSchema>;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.appointment.findMany({
      include: { client: true, barber: true },
      orderBy: { scheduledAt: "asc" }
    });
  }

  async create(payload: AppointmentInput) {
    const serviceType = payload.serviceType as AppointmentServiceType;
    const service = serviceCatalog[serviceType];
    if (!service) throw new BadRequestException("Servico invalido");
    if (service.estimatedMinutes <= 0) throw new BadRequestException("Duracao do servico invalida");

    const scheduledAt = new Date(payload.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException("Horario invalido");
    if (scheduledAt <= new Date()) throw new BadRequestException("Nao e permitido agendar no passado");

    const endTime = new Date(scheduledAt.getTime() + service.estimatedMinutes * 60 * 1000);

    const [client, barber] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: payload.clientId, isActive: true } }),
      this.prisma.user.findFirst({ where: { id: payload.barberId, role: "BARBER" } })
    ]);

    if (!client) throw new NotFoundException("Cliente nao encontrado");
    if (!barber) throw new NotFoundException("Barbeiro nao encontrado");

    const conflict = await this.prisma.appointment.findFirst({
      where: {
        barberId: payload.barberId,
        status: AppointmentStatus.SCHEDULED,
        scheduledAt: { lt: endTime },
        endTime: { gt: scheduledAt }
      }
    });

    if (conflict) {
      throw new BadRequestException("Barbeiro indisponivel neste horario");
    }

    return this.prisma.appointment.create({
      data: {
        clientId: payload.clientId,
        barberId: payload.barberId,
        serviceType,
        scheduledAt,
        endTime,
        estimatedMinutes: service.estimatedMinutes,
        price: service.price,
        notes: payload.notes,
        status: AppointmentStatus.SCHEDULED
      }
    });
  }

  async updateStatus(id: string, status: AppointmentStatus) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException("Agendamento nao encontrado");
    const shouldIncrementClientTotal = status === AppointmentStatus.COMPLETED
      && appointment.status !== AppointmentStatus.COMPLETED;

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status,
        client: shouldIncrementClientTotal
          ? {
              update: {
                lastVisitAt: appointment.endTime,
                totalSpent: { increment: appointment.price }
              }
            }
          : undefined
      },
      include: { client: true, barber: true }
    });
  }

  async cancel(id: string) {
    return this.updateStatus(id, AppointmentStatus.CANCELLED);
  }

  serviceTypes() {
    return Object.entries(serviceCatalog).map(([key, value]) => ({
      type: key,
      ...value
    }));
  }
}
