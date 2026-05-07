import { NotFoundException } from "@nestjs/common";
import { ClientsService } from "./clients.service";

describe("ClientsService", () => {
  it("creates client without classification", async () => {
    const prisma = {
      client: {
        create: jest.fn().mockResolvedValue({ id: "client-1" })
      }
    };
    const service = new ClientsService(prisma as never);

    await service.create({ name: "Gustavo", email: "", phone: "(11) 99999-9999", whatsappOptIn: true });

    expect(prisma.client.create).toHaveBeenCalledWith({
      data: {
        name: "Gustavo",
        email: null,
        phone: "(11) 99999-9999",
        whatsappOptIn: true
      }
    });
  });

  it("throws NotFoundException when client detail does not exist", async () => {
    const prisma = {
      client: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    };
    const service = new ClientsService(prisma as never);

    await expect(service.detail("missing-client")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns useful client summary metrics", async () => {
    const prisma = {
      client: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(4),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalSpent: 1250 } })
      }
    };
    const service = new ClientsService(prisma as never);

    const result = await service.list("", 1);

    expect(result.summary).toEqual({
      totalClients: 10,
      attendedThisMonth: 4,
      revenueFromClients: 1250
    });
  });

  it("soft deletes client instead of removing history", async () => {
    const prisma = {
      client: {
        findFirst: jest.fn().mockResolvedValue({ id: "client-1", isActive: true }),
        update: jest.fn().mockResolvedValue({ id: "client-1", isActive: false })
      }
    };
    const service = new ClientsService(prisma as never);

    await service.remove("client-1");

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { isActive: false }
    });
  });
});
