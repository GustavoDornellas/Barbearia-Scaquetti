import { z } from "zod";

export const appointmentSchema = z.object({
  clientId: z.string().min(1),
  barberId: z.string().min(1),
  serviceType: z.enum(["CORTE", "BARBA", "COMBO"]),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional()
});

export const appointmentStatusSchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED", "NO_SHOW"])
});
