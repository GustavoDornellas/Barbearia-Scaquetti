import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

@Injectable()
export class CsrfService {
  private readonly secret: string;

  constructor() {
    // Reutiliza o JWT_ACCESS_SECRET — já existe, já é longo o suficiente
    this.secret = process.env.JWT_ACCESS_SECRET ?? "fallback-csrf-secret-change-in-production";
  }

  generate(): string {
    const timestamp = Date.now().toString();
    const hmac = crypto
      .createHmac("sha256", this.secret)
      .update(timestamp)
      .digest("hex");
    return `${timestamp}.${hmac}`;
  }

  validate(token: string): boolean {
    if (!token || typeof token !== "string") return false;

    const dotIndex = token.lastIndexOf(".");
    if (dotIndex === -1) return false;

    const timestamp = token.slice(0, dotIndex);
    const hmac = token.slice(dotIndex + 1);

    // Verifica TTL
    const age = Date.now() - parseInt(timestamp, 10);
    if (isNaN(age) || age < 0 || age > TOKEN_TTL_MS) return false;

    // Verifica assinatura — timingSafeEqual previne timing attacks
    const expected = crypto
      .createHmac("sha256", this.secret)
      .update(timestamp)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(expected, "hex"));
    } catch {
      return false;
    }
  }
}
