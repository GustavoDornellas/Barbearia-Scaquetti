import { z } from "zod";

export const queueSchema = z.object({
  clientId: z.string().min(1),
  barberId: z.string().optional(),
  appointmentId: z.string().optional(),
  serviceLabel: z.string().trim().min(2, "Informe o servico"),
  serviceDuration: z.number().int().min(5, "Tempo minimo de 5 minutos").max(240, "Tempo maximo de 240 minutos"),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horario invalido").optional().or(z.literal(""))
});

export const queueStatusSchema = z.object({
  status: z.enum(["WAITING", "IN_SERVICE", "CANCELLED"])
});

export const finishQueueSchema = z.object({
  amount: z.number().min(0, "Valor nao pode ser negativo")
});
