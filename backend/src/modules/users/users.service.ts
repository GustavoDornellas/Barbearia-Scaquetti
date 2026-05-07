import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listBarbers() {
    return this.prisma.user.findMany({
      where: { role: "BARBER" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });
  }
}

