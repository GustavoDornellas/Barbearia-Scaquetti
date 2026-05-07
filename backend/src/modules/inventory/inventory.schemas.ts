import { z } from "zod";

export const inventorySchema = z.object({
  name: z.string().min(3),
  sku: z.string().min(3),
  category: z.string().min(2),
  quantity: z.number().int().min(0),
  unit: z.string().min(1),
  costPrice: z.number().min(0),
  salePrice: z.number().min(0),
  lowStockAlert: z.number().int().min(1),
  criticalAlert: z.number().int().min(1)
});

export const inventoryMovementSchema = z.object({
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().int().min(1),
  reason: z.string().max(255).optional()
});
