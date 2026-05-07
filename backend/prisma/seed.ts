import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import "dotenv/config";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_NAME = "Administrador";
const BLOCKED_DEFAULT_PASSWORDS = new Set(["Admin@123"]);

function validateStrongPassword(password: string) {
  const rules = [
    { valid: password.length >= 12, message: "pelo menos 12 caracteres" },
    { valid: /[A-Z]/.test(password), message: "uma letra maiuscula" },
    { valid: /[a-z]/.test(password), message: "uma letra minuscula" },
    { valid: /\d/.test(password), message: "um numero" },
    { valid: /[^A-Za-z0-9]/.test(password), message: "um caractere especial" }
  ];
  const missingRules = rules.filter((rule) => !rule.valid).map((rule) => rule.message);

  if (missingRules.length > 0) {
    throw new Error(`ADMIN_PASSWORD fraca. Use ${missingRules.join(", ")}.`);
  }
}

function getAdminSeedConfig() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || DEFAULT_ADMIN_NAME;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD sao obrigatorios para executar o seed de admin.");
  }

  if (BLOCKED_DEFAULT_PASSWORDS.has(password)) {
    throw new Error("ADMIN_PASSWORD nao pode usar uma senha padrao conhecida.");
  }

  validateStrongPassword(password);

  return { email: email.toLowerCase(), name, password };
}

async function main() {
  const { email, name, password } = getAdminSeedConfig();
  const existingAdmin = await prisma.user.findUnique({ where: { email } });

  if (existingAdmin) {
    console.log(`Admin inicial ja existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  console.log(`Admin inicial criado: ${email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
