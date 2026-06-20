import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { RbacService } from '../../platform/rbac/rbac.service';
import type { RoleName } from '@vms/shared';

// --- Zero-dependency RFC 6238 TOTP (compatible with Google Authenticator) ---

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totpCode(secret: string, timeStep = 30, digits = 6, t = Date.now()): string {
  const counter = Math.floor(t / 1000 / timeStep);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

function verifyTotp(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const now = Date.now();
  // Accept current + 1 step before/after for clock skew
  for (const offset of [-1, 0, 1]) {
    if (totpCode(secret, 30, 6, now + offset * 30_000) === token) return true;
  }
  return false;
}

function totpUri(label: string, issuer: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  orgId: string | null;
  branchId: string;
  perms?: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private rbac: RbacService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    // Resolve org via branch
    const branch = await this.prisma.branch.findUnique({
      where: { id: user.branchId },
      select: { organizationId: true },
    });

    // Bake effective permission set into the access token so PermissionGuard
    // can decide without a DB hit per request. Permission changes take effect
    // at next refresh (≤ refresh-TTL) or on explicit re-resolve.
    const permsSet = await this.rbac.resolveForUser({
      userId: user.id,
      role: user.role as RoleName,
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: branch?.organizationId ?? null,
      branchId: user.branchId,
      perms: Array.from(permsSet),
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        branchId: user.branchId,
        orgId: branch?.organizationId ?? null,
      },
    };
  }

  async register(email: string, password: string, fullName: string, branchId: string, role: string = 'EMPLOYEE') {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        fullName,
        branchId,
        role: role as any,
      },
    });

    return this.login(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new Error('Current password is incorrect');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { ok: true };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        branchId: true,
        branch: { select: { id: true, name: true, location: true } },
        totpEnabled: true,
        createdAt: true,
      },
    });
  }

  // --- 2FA ----------------------------------------------------------------

  /** Generate a pending TOTP secret + provisioning URI; only saved when verified. */
  async totpSetup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, totpEnabled: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.totpEnabled) throw new BadRequestException('2FA already enabled');

    const secret = base32Encode(crypto.randomBytes(20));
    // Store secret but don't flip totpEnabled until user verifies
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });
    return {
      secret,
      otpauthUrl: totpUri(user.email, 'TSI VMS', secret),
    };
  }

  async totpEnable(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabled: true },
    });
    if (!user?.totpSecret) throw new BadRequestException('Run totp setup first');
    if (!verifyTotp(user.totpSecret, token)) {
      throw new UnauthorizedException('Invalid code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
    return { enabled: true };
  }

  async totpDisable(userId: string, currentPassword: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, totpSecret: true, totpEnabled: true },
    });
    if (!user?.totpEnabled || !user.totpSecret) throw new BadRequestException('2FA not enabled');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (!verifyTotp(user.totpSecret, token)) {
      throw new UnauthorizedException('Invalid code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    return { enabled: false };
  }

  /**
   * Login flow with optional TOTP. Returns either an access token (no 2FA)
   * or a partial response demanding `totp` on the second call.
   */
  async loginWithOptionalTotp(email: string, password: string, totp?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.totpEnabled && user.totpSecret) {
      if (!totp) {
        // Step 1: prompt for code
        return { totpRequired: true };
      }
      if (!verifyTotp(user.totpSecret, totp)) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }
    return this.login(user);
  }

  // --- Password reset ----------------------------------------------------

  async createResetToken(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    // Always return the same shape so this isn't an enumeration oracle
    if (!user) return { ok: true };
    const token = crypto.randomBytes(48).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      },
    });
    // TODO: email the reset link to the user. The raw token is only returned
    // outside production (dev/demo convenience); never leak it in prod.
    if (process.env.NODE_ENV === 'production') {
      return { ok: true };
    }
    return { ok: true, token };
  }

  async resetPasswordWithToken(token: string, newPassword: string) {
    if (!token || newPassword.length < 6) {
      throw new BadRequestException('Invalid request');
    }
    const row = await this.prisma.passwordResetToken.findUnique({ where: { token } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Token invalid or expired');
    }
    await this.prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    await this.prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return { ok: true };
  }
}
