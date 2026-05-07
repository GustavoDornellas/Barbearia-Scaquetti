import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Nome e obrigatorio"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().refine((value) => value.replace(/\D/g, "").length >= 10, "Telefone deve ter ao menos 10 digitos"),
  notes: z.string().optional(),
  whatsappOptIn: z.boolean().default(false)
});

export type ClientInput = z.infer<typeof clientSchema>;
