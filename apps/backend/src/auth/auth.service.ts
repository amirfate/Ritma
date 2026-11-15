import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';

import { AuditService } from '../audit/audit.service';
import { BetaService } from '../beta/beta.service';
import { DevicesService, type DeviceAttempt } from '../devices/devices.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthedUser } from './guards/auth.guards';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

const REFRESH_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly beta: BetaService,
    private readonly devices: DevicesService,
    private readonly audit: AuditService,
  ) {}

  async register(
    dto: RegisterDto,
    device?: DeviceAttempt,
  ): Promise<TokenPair & { user: AuthedUser }> {
    // Beta gates: seat capacity, invite validity, device limit.
    await this.beta.assertRegistrationAllowed();
    const invite = await this.beta.assertInviteUsable(dto.inviteCode);
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('این ایمیل قبلاً ثبت شده است');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: dto.email, passwordHash, name: dto.name },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { usedByUserId: created.id, usedAt: new Date() },
      });
      // Register the first device inside the transaction, after the user
      // exists — a 'pending' row would violate the FK to User.
      if (device) {
        await tx.deviceSession.create({
          data: {
            userId: created.id,
            deviceKey: device.deviceKey,
            deviceName: device.deviceName ?? null,
            lastIp: device.ip ?? null,
          },
        });
      }
      return created;
    });
    this.audit.log({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      after: { inviteCode: invite.code, device: device?.deviceKey },
      ip: device?.ip,
    });
    return { ...(await this.issueTokens(user.id, user.email, user.role)), user: { sub: user.id, email: user.email, role: user.role } };
  }

  async login(
    dto: LoginDto,
    device?: DeviceAttempt,
  ): Promise<TokenPair & { user: AuthedUser }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('ایمیل یا گذرواژه نادرست است');
    }
    await this.devices.assertDeviceAllowed(user.id, device ?? { deviceKey: DevicesService.keyFor(undefined) }, this.beta.devicesPerUser);
    this.audit.log({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      after: { device: device?.deviceKey },
      ip: device?.ip,
    });
    return { ...(await this.issueTokens(user.id, user.email, user.role)), user: { sub: user.id, email: user.email, role: user.role } };
  }

  async refresh(token: string): Promise<TokenPair> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.revoked || row.expiresAt < new Date()) {
      throw new UnauthorizedException('نشست منقضی شده است');
    }
    // rotation: revoke old, issue new
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revoked: true } });
    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user) throw new UnauthorizedException('کاربر یافت نشد');
    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(userId: string, refreshToken?: string): Promise<{ ok: true }> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refreshToken), userId },
        data: { revoked: true },
      });
    } else {
      await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
    }
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, plan: true, createdAt: true },
    });
    if (!user) throw new UnauthorizedException('کاربر یافت نشد');
    return user;
  }

  private async issueTokens(userId: string, email: string, role: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({ sub: userId, email, role });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86400_000),
      },
    });
    return { accessToken, refreshToken };
  }
}
