import { BadRequestException } from "@nestjs/common";
import { AppointmentStatus } from "@prisma/client";
import { AppointmentsService } from "./appointments.service";

describe("AppointmentsService", () => {
  it("rejects overlapping appointments for the same barber", async () => {
    const prisma = {
      client: { findFirst: jest.fn().mockResolvedValue({ id: "client-1", isActive: true }) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: "barber-1" }) },
      appointment: {
        findFirst: jest.fn().mockResolvedValue({ id: "existing" }),
        create: jest.fn()
      }
    };
    const service = new AppointmentsService(prisma as never);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await expect(service.create({ clientId: "client-1", barberId: "barber-1", serviceType: "CORTE", scheduledAt: future }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects appointments in the past", async () => {
    const prisma = {
      client: { findFirst: jest.fn() },
      user: { findFirst: jest.fn() },
      appointment: { findFirst: jest.fn(), create: jest.fn() }
    };
    const service = new AppointmentsService(prisma as never);
    const past = new Date(Date.now() - 60 * 1000).toISOString();

    await expect(service.create({ clientId: "client-1", barberId: "barber-1", serviceType: "CORTE", scheduledAt: past }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not increment client total twice when appointment is already completed", async () => {
    const appointment = {
      id: "appointment-1",
      status: AppointmentStatus.COMPLETED,
      price: 80,
      endTime: new Date()
    };
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(appointment),
        update: jest.fn().mockResolvedValue({ ...appointment, client: {}, barber: {} })
      }
    };
    const service = new AppointmentsService(prisma as never);

    await service.updateStatus("appointment-1", AppointmentStatus.COMPLETED);

    expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        status: AppointmentStatus.COMPLETED,
        client: undefined
      }
    }));
  });
});
