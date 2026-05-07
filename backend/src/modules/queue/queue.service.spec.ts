import { BadRequestException } from "@nestjs/common";
import { QueueStatus } from "@prisma/client";
import { QueueService } from "./queue.service";

describe("QueueService", () => {
  it("calculates position and estimated wait inside transaction", async () => {
    const now = new Date();
    const tx = {
      client: { findFirst: jest.fn().mockResolvedValue({ id: "client-1", name: "Ana", phone: "(11) 99999-9999", isActive: true }) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: "barber-1" }) },
      queueEntry: {
        findMany: jest.fn()
          .mockResolvedValueOnce([
            { id: "queue-2", clientId: "client-2", status: QueueStatus.WAITING, position: 1, serviceDuration: 30, scheduledFor: now },
            { id: "queue-3", clientId: "client-3", status: QueueStatus.WAITING, position: 2, serviceDuration: 20, scheduledFor: now }
          ])
          .mockResolvedValueOnce([
            { id: "queue-2", clientId: "client-2", status: QueueStatus.WAITING, position: 1, serviceDuration: 30, scheduledFor: now },
            { id: "queue-3", clientId: "client-3", status: QueueStatus.WAITING, position: 2, serviceDuration: 20, scheduledFor: now },
            { id: "queue-1", clientId: "client-1", status: QueueStatus.WAITING, position: 3, serviceDuration: 60, scheduledFor: now }
          ]),
        create: jest.fn().mockResolvedValue({
          id: "queue-1",
          estimatedMinutes: 50,
          serviceDuration: 60,
          scheduledFor: now,
          client: { name: "Ana", phone: "(11) 99999-9999" },
          barber: { id: "barber-1", name: "Barbeiro" }
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: "queue-1",
          estimatedMinutes: 50,
          serviceDuration: 60,
          scheduledFor: now,
          client: { name: "Ana", phone: "(11) 99999-9999" },
          barber: { id: "barber-1", name: "Barbeiro" }
        }),
        update: jest.fn()
      }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new QueueService(prisma as never);

    await service.create({ clientId: "client-1", serviceLabel: "Corte freestyle", serviceDuration: 60 }, "barber-1");

    expect(tx.queueEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        position: 3,
        estimatedMinutes: 50,
        serviceDuration: 60,
        serviceLabel: "Corte freestyle",
        status: QueueStatus.WAITING
      })
    }));
  });

  it("prevents the same client from entering the active queue twice", async () => {
    const tx = {
      client: { findFirst: jest.fn().mockResolvedValue({ id: "client-1", name: "Ana", phone: "11999999999", isActive: true }) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: "barber-1" }) },
      queueEntry: {
        findMany: jest.fn().mockResolvedValue([{ clientId: "client-1", serviceDuration: 30, scheduledFor: new Date() }]),
        create: jest.fn()
      }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new QueueService(prisma as never);

    await expect(service.create({ clientId: "client-1", serviceLabel: "Corte", serviceDuration: 30 }, "barber-1"))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.queueEntry.create).not.toHaveBeenCalled();
  });

  it("always calls the waiting item with the smallest position", async () => {
    const tx = {
      queueEntry: {
        findFirst: jest.fn().mockResolvedValue({
          id: "queue-2",
          status: QueueStatus.WAITING,
          position: 2,
          serviceDuration: 30,
          client: { name: "Ana", phone: "5511999999999" },
          barber: null
        }),
        update: jest.fn().mockResolvedValue({
          id: "queue-2",
          estimatedMinutes: 0,
          serviceDuration: 30,
          status: QueueStatus.IN_SERVICE,
          client: { name: "Ana", phone: "5511999999999" },
          barber: null
        }),
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new QueueService(prisma as never);

    await service.callNext();

    expect(tx.queueEntry.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: QueueStatus.WAITING }),
      orderBy: { position: "asc" }
    }));
    expect(tx.queueEntry.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "queue-2" } }));
  });

  it("does not require scheduled time to call next client", async () => {
    const tx = {
      queueEntry: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({
            id: "queue-1",
            status: QueueStatus.WAITING,
            position: 1,
            serviceDuration: 30,
            scheduledFor: new Date(Date.now() + 60 * 60 * 1000),
            barberId: "barber-1",
            client: { name: "Ana", phone: "5511999999999" },
            barber: { id: "barber-1", name: "Barbeiro" }
          })
          .mockResolvedValueOnce(null),
        update: jest.fn().mockResolvedValue({
          id: "queue-1",
          estimatedMinutes: 0,
          serviceDuration: 30,
          status: QueueStatus.IN_SERVICE,
          client: { name: "Ana", phone: "5511999999999" },
          barber: null
        }),
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new QueueService(prisma as never);

    await service.callNext();

    expect(tx.queueEntry.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: QueueStatus.WAITING },
      orderBy: { position: "asc" }
    }));
  });

  it("advances a future waiting item and generates whatsapp confirmation", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const tx = {
      queueEntry: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({
            id: "queue-1",
            status: QueueStatus.WAITING,
            scheduledFor: future,
            serviceDuration: 30,
            client: { name: "Ana", phone: "11999999999" },
            barber: null
          })
          .mockResolvedValueOnce({
            id: "queue-1",
            status: QueueStatus.WAITING,
            scheduledFor: new Date(),
            estimatedMinutes: 0,
            serviceDuration: 30,
            client: { name: "Ana", phone: "11999999999" },
            barber: null
          }),
        update: jest.fn().mockResolvedValue({ id: "queue-1" }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "queue-1",
            status: QueueStatus.WAITING,
            position: 1,
            serviceDuration: 30,
            scheduledFor: new Date()
          }
        ])
      }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new QueueService(prisma as never);

    const result = await service.advance("queue-1");

    expect(tx.queueEntry.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "queue-1" },
      data: expect.objectContaining({ scheduledFor: expect.any(Date) })
    }));
    expect(result.whatsapp).toContain("https://wa.me/5511999999999");
    expect(result.whatsapp).toContain("Consegui%20antecipar");
  });

  it("finishes an in-service item with paid amount", async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: "barber-1" })
      },
      appointment: {
        create: jest.fn().mockResolvedValue({ id: "appointment-1" }),
        update: jest.fn()
      },
      client: {
        update: jest.fn()
      },
      queueEntry: {
        findUnique: jest.fn().mockResolvedValue({
          id: "queue-1",
          status: QueueStatus.IN_SERVICE,
          clientId: "client-1",
          barberId: "barber-1",
          appointmentId: null,
          appointment: null,
          serviceType: "CORTE",
          serviceDuration: 30,
          serviceLabel: "Corte",
          scheduledFor: new Date(),
          startedAt: new Date(),
          client: { name: "Ana", phone: "5511999999999" },
          barber: null
        }),
        update: jest.fn().mockResolvedValue({
          id: "queue-1",
          estimatedMinutes: 0,
          serviceDuration: 30,
          status: QueueStatus.FINISHED,
          paidAmount: 85,
          client: { name: "Ana", phone: "5511999999999" },
          barber: null
        }),
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new QueueService(prisma as never);

    await service.finish("queue-1", { amount: 85 });

    expect(tx.queueEntry.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: QueueStatus.FINISHED,
        paidAmount: 85,
        appointmentId: "appointment-1"
      })
    }));
    expect(tx.appointment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "COMPLETED",
        price: 85
      })
    }));
  });
});
