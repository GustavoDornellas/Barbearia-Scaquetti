import { AppointmentServiceType } from "@prisma/client";

export const serviceCatalog: Record<AppointmentServiceType, { label: string; estimatedMinutes: number; price: number }> = {
  CORTE: { label: "Corte", estimatedMinutes: 30, price: 55 },
  BARBA: { label: "Barba", estimatedMinutes: 20, price: 40 },
  COMBO: { label: "Combo", estimatedMinutes: 45, price: 95 }
};
