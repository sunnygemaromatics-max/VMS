import { Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: (req: any) => {
        const token = req?.headers?.authorization?.split(' ')[1];
        return token;
      },
      ignoreExpiration: false,
      // Prod boot fails fast (main.ts) if JWT_SECRET is unset; this dev-only
      // fallback never applies in production.
      secretOrKey:
        process.env.JWT_SECRET ||
        (process.env.NODE_ENV === 'production' ? '' : 'dev_only_insecure_secret'),
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      orgId: payload.orgId ?? null,
      branchId: payload.branchId ?? null,
      perms: Array.isArray(payload.perms) ? (payload.perms as string[]) : undefined,
    };
  }
}
