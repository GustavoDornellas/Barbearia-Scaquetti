import { BadRequestException } from "@nestjs/common";
import { InventoryService } from "./inventory.service";

describe("InventoryService", () => {
  it("prevents negative stock on outbound movement", async () => {
    const tx = {
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue({ id: "item-1", quantity: 2, lowStockAlert: 5, criticalAlert: 1 }),
        update: jest.fn()
      }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new InventoryService(prisma as never);

    await expect(service.move("item-1", { type: "OUT", quantity: 3 })).rejects.toBeInstanceOf(BadRequestException);
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
