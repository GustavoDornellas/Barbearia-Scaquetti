import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Nome e obrigatorio"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().refine((value) => {
    const digits = value.replace(/\D/g, "");
    return /^[1-9]{2}9\d{8}$/.test(digits);
  }, "Telefone deve ser um celular brasileiro com 11 digitos"),
  notes: z.string().optional(),
  whatsappOptIn: z.boolean().default(false)
});

export type ClientInput = z.infer<typeof clientSchema>;
