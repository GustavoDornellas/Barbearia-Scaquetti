import { DashboardService } from "./dashboard.service";

describe("DashboardService", () => {
  it("returns zero and empty arrays when there is no data", async () => {
    const prisma = {
      client: { count: jest.fn().mockResolvedValue(0) },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      productSale: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalPrice: null }, _count: { _all: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([])
      },
      appointment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { price: null }, _count: { _all: 0 } }),
        findMany: jest.fn().mockResolvedValue([])
      },
      queueEntry: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const service = new DashboardService(prisma as never);

    const result = await service.getOverview();

    expect(result.revenueToday).toBe(0);
    expect(result.totalClients).toBe(0);
    expect(result.averageTicket).toBe(0);
    expect(result.productsSoldToday).toBe(0);
    expect(result.popularProducts).toEqual([]);
    expect(result.recentActivities).toEqual([]);
    expect(result.weeklyRevenue).toHaveLength(7);
    expect(result.weeklyRevenue.every((point) => point.value === 0)).toBe(true);
    expect(result.flowTrend.buckets).toHaveLength(6);
  });

  it("returns only the latest finished activity", async () => {
    const olderDate = new Date("2026-04-29T10:00:00.000Z");
    const latestDate = new Date("2026-04-29T11:00:00.000Z");
    const appointmentFindMany = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "appointment-1",
          serviceType: "CORTE",
          status: "COMPLETED",
          price: 50,
          endTime: olderDate,
          updatedAt: olderDate,
          client: { name: "Cliente antigo" }
        }
      ])
      .mockResolvedValueOnce([
        { endTime: latestDate },
        { endTime: olderDate }
      ]);
    const queueFindMany = jest.fn()
      .mockResolvedValue([]);
    const prisma = {
      client: { count: jest.fn().mockResolvedValue(2) },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { price: null }, _count: { _all: 0 } }),
        findMany: appointmentFindMany
      },
      productSale: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalPrice: null }, _count: { _all: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([])
      },
      queueEntry: {
        count: jest.fn().mockResolvedValue(0),
        findMany: queueFindMany
      }
    };
    const service = new DashboardService(prisma as never);

    const result = await service.getOverview();

    expect(result.recentActivities).toHaveLength(1);
    expect(result.recentActivities[0]).toEqual({
      id: "appointment-1",
      clientName: "Cliente antigo",
      serviceLabel: "CORTE",
      price: 50,
      finishedAt: olderDate.toISOString(),
      status: "FINALIZADO"
    });
  });

  it("does not duplicate revenue from queue entries linked to appointments", async () => {
    const today = new Date();
    const prisma = {
      client: { count: jest.fn().mockResolvedValue(1) },
      appointment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { price: 50 }, _count: { _all: 1 } }),
        findMany: jest.fn()
          .mockResolvedValueOnce([{ id: "appointment-1", price: 50, endTime: today, serviceType: "CORTE" }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ endTime: today }])
      },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      productSale: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalPrice: null }, _count: { _all: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([])
      },
      queueEntry: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([{ appointmentId: "appointment-1", paidAmount: 50 }])
      }
    };
    const service = new DashboardService(prisma as never);

    const result = await service.getOverview();

    expect(result.revenueToday).toBe(50);
  });

  it("includes flow trend in the dashboard overview", async () => {
    const prisma = {
      client: { count: jest.fn().mockResolvedValue(1) },
      queueEntry: { count: jest.fn().mockResolvedValue(0) },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      productSale: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalPrice: null }, _count: { _all: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([])
      },
      appointment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { price: null }, _count: { _all: 0 } }),
        findMany: jest.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { endTime: new Date(2026, 3, 29, 15, 10) },
            { endTime: new Date(2026, 3, 29, 15, 40) },
            { endTime: new Date(2026, 3, 29, 12, 15) },
            { endTime: new Date(2026, 3, 29, 18, 20) }
          ])
      }
    };
    const service = new DashboardService(prisma as never);

    const result = await service.getOverview();

    expect(result.flowTrend).toEqual({
      buckets: [
        { label: "08H", count: 0, percentage: 0 },
        { label: "10H", count: 0, percentage: 0 },
        { label: "12H", count: 1, percentage: 50 },
        { label: "15H", count: 2, percentage: 100 },
        { label: "18H", count: 1, percentage: 50 },
        { label: "20H", count: 0, percentage: 0 }
      ],
      peakLabel: "15H"
    });
  });

  it("adds product sales to dashboard revenue without changing appointment ticket average", async () => {
    const today = new Date();
    const prisma = {
      client: { count: jest.fn().mockResolvedValue(1) },
      appointment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { price: 80 }, _count: { _all: 1 } }),
        findMany: jest.fn()
          .mockResolvedValueOnce([{ id: "appointment-1", price: 80, endTime: today, serviceType: "CORTE" }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ endTime: today }])
      },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      productSale: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalPrice: 40, quantity: 3 }, _count: { _all: 1 } }),
        findMany: jest.fn()
          .mockResolvedValueOnce([{ totalPrice: 40, createdAt: today }]),
        groupBy: jest.fn().mockResolvedValue([])
      },
      queueEntry: { count: jest.fn().mockResolvedValue(0) }
    };
    const service = new DashboardService(prisma as never);

    const result = await service.getOverview();

    expect(result.revenueToday).toBe(120);
    expect(result.averageTicket).toBe(80);
    expect(result.productsSoldToday).toBe(3);
  });

  it("returns best-selling products based on product sales quantities", async () => {
    const today = new Date();
    const prisma = {
      client: { count: jest.fn().mockResolvedValue(1) },
      appointment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { price: null }, _count: { _all: 0 } }),
        findMany: jest.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ endTime: today }])
      },
      productSale: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalPrice: null }, _count: { _all: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([
          { inventoryItemId: "pomada", _sum: { quantity: 20 } },
          { inventoryItemId: "oleo", _sum: { quantity: 10 } },
          { inventoryItemId: "shampoo", _sum: { quantity: 5 } }
        ])
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: "pomada", name: "Pomada Matte", category: "Barber Pro" },
          { id: "oleo", name: "Óleo para barba", category: "Seda" },
          { id: "shampoo", name: "Shampoo", category: "Clear" }
        ])
      },
      queueEntry: { count: jest.fn().mockResolvedValue(0) }
    };
    const service = new DashboardService(prisma as never);

    const result = await service.getOverview();

    expect(result.popularProducts).toEqual([
      { label: "Pomada Matte - Barber Pro", count: 20, percentage: 100 },
      { label: "Óleo para barba - Seda", count: 10, percentage: 50 },
      { label: "Shampoo - Clear", count: 5, percentage: 25 }
    ]);
  });
});
