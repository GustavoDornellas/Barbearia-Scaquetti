import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ExecutionContext } from "@nestjs/common";

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ip ?? req.connection?.remoteAddress ?? "unknown";
    const email = (req.body?.email ?? "").toLowerCase().trim();

    // Rastreia por IP + email — um atacante que troca de IP não consegue
    // continuar atacando a mesma conta; e um IP compartilhado não bloqueia
    // usuários com emails diferentes.
    if (email) {
      return `login:${ip}:${email}`;
    }

    // Sem email no body — rastreia só por IP
    return `login:${ip}`;
  }
}
