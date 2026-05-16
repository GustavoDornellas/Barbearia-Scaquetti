import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InventoryMovementType, InventoryStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";
import { z } from "zod";
import { inventoryMovementSchema, inventorySchema } from "./inventory.schemas";

type InventoryInput = z.infer<typeof inventorySchema>;
type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;

@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.inventoryItem.findMany({
      where: { isActive: true },
      include: {
        movements: {
          orderBy: { createdAt: "desc" },
          take: 5
        }
      },
      orderBy: [{ status: "desc" }, { quantity: "asc" }]
    });

    return {
      items,
      summary: {
        totalItems: items.length,
        lowStock: items.filter((item) => item.status !== InventoryStatus.NORMAL).length,
        marketValue: items.reduce((sum, item) => sum + Number(item.salePrice) * item.quantity, 0)
      }
    };
  }

  async create(payload: InventoryInput) {
    if (payload.criticalAlert > payload.lowStockAlert) {
      throw new BadRequestException("Alerta critico deve ser menor ou igual ao alerta de estoque baixo");
    }

    return this.prisma.inventoryItem.create({
      data: {
        ...payload,
        isActive: true,
        status: this.resolveStatus(payload.quantity, payload.lowStockAlert, payload.criticalAlert),
        movements: {
          create: {
            type: InventoryMovementType.IN,
            quantity: payload.quantity,
            previousQuantity: 0,
            nextQuantity: payload.quantity,
            reason: "Cadastro inicial"
          }
        }
      },
      include: { movements: true }
    });
  }

  async update(id: string, payload: InventoryInput) {
    if (payload.criticalAlert > payload.lowStockAlert) {
      throw new BadRequestException("Alerta critico deve ser menor ou igual ao alerta de estoque baixo");
    }

    const current = await this.prisma.inventoryItem.findFirst({ where: { id, isActive: true } });
    if (!current) throw new NotFoundException("Produto nao encontrado");

    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...payload,
        status: this.resolveStatus(payload.quantity, payload.lowStockAlert, payload.criticalAlert),
        movements: {
          create: payload.quantity !== current.quantity
            ? {
                type: InventoryMovementType.ADJUSTMENT,
                quantity: Math.abs(payload.quantity - current.quantity),
                previousQuantity: current.quantity,
                nextQuantity: payload.quantity,
                reason: "Ajuste cadastral"
              }
            : undefined
        }
      },
      include: { movements: { orderBy: { createdAt: "desc" } } }
    });
  }

  async remove(id: string) {
    const current = await this.prisma.inventoryItem.findFirst({ where: { id, isActive: true } });
    if (!current) throw new NotFoundException("Produto nao encontrado");

    await this.prisma.inventoryItem.update({ where: { id }, data: { isActive: false } });
    return { message: "Produto removido" };
  }

  async move(id: string, payload: InventoryMovementInput) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id, isActive: true } });
      if (!item) throw new NotFoundException("Produto nao encontrado");

      const nextQuantity = this.calculateNextQuantity(item.quantity, payload);
      if (nextQuantity < 0) throw new BadRequestException("Quantidade nao pode ficar negativa");
      const saleTotal = Number(item.salePrice) * payload.quantity;

      return tx.inventoryItem.update({
        where: { id },
        data: {
          quantity: nextQuantity,
          status: this.resolveStatus(nextQuantity, item.lowStockAlert, item.criticalAlert),
          movements: {
            create: {
              type: payload.type as InventoryMovementType,
              quantity: payload.quantity,
              previousQuantity: item.quantity,
              nextQuantity,
              reason: payload.reason
            }
          },
          productSales: payload.type === InventoryMovementType.OUT
            ? {
                create: {
                  quantity: payload.quantity,
                  unitPrice: item.salePrice,
                  totalPrice: saleTotal
                }
              }
            : undefined
        },
        include: { movements: { orderBy: { createdAt: "desc" } } }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private calculateNextQuantity(current: number, payload: InventoryMovementInput) {
    if (payload.type === "IN") return current + payload.quantity;
    if (payload.type === "OUT") return current - payload.quantity;
    return payload.quantity;
  }

  private resolveStatus(quantity: number, low: number, critical: number) {
    if (quantity <= critical) return InventoryStatus.CRITICAL;
    if (quantity <= low) return InventoryStatus.LOW;
    return InventoryStatus.NORMAL;
  }
}
