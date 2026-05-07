import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";

function extractJwt(request: Request) {
  return request?.cookies?.accessToken ?? ExtractJwt.fromAuthHeaderAsBearerToken()(request);
}

type JwtPayload = {
  sub: string;
  email?: string;
  role?: string;
  name?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: extractJwt,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET as string
    });
  }

  async validate(payload: JwtPayload) {
    return payload;
  }
}
