import { BadRequestException } from "@nestjs/common";
import { InventoryService } from "./inventory.service";

describe("InventoryService", () => {
  it("prevents negative stock on outbound movement", async () => {
    const tx = {
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue({ id: "item-1", quantity: 2, salePrice: 20, lowStockAlert: 5, criticalAlert: 1 }),
        update: jest.fn()
      }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new InventoryService(prisma as never);

    await expect(service.move("item-1", { type: "OUT", quantity: 3 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("registers product sale revenue on outbound movement", async () => {
    const tx = {
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue({ id: "item-1", quantity: 5, salePrice: 25, lowStockAlert: 5, criticalAlert: 1 }),
        update: jest.fn().mockResolvedValue({ id: "item-1", quantity: 3 })
      }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new InventoryService(prisma as never);

    await service.move("item-1", { type: "OUT", quantity: 2 });

    expect(tx.inventoryItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        productSales: {
          create: {
            quantity: 2,
            unitPrice: 25,
            totalPrice: 50
          }
        }
      })
    }));
  });

  it("soft deletes inventory items instead of removing history", async () => {
    const prisma = {
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue({ id: "item-1", isActive: true }),
        update: jest.fn().mockResolvedValue({ id: "item-1", isActive: false }),
        delete: jest.fn()
      }
    };
    const service = new InventoryService(prisma as never);

    await service.remove("item-1");

    expect(prisma.inventoryItem.update).toHaveBeenCalledWith({ where: { id: "item-1" }, data: { isActive: false } });
    expect(prisma.inventoryItem.delete).not.toHaveBeenCalled();
  });
});
