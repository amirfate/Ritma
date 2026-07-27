import { Injectable } from '@nestjs/common';
import { type User } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceService } from './device.service';
import { type IssuedTokens, TokenService } from './token.service';
import { OtpService } from './otp.service';

export interface VerifyInput {
  phoneNumber: string;
  code: string;
  deviceFingerprint: string;
  devicePlatform: string;
  deviceLabel?: string;
}

export interface VerifyResult extends IssuedTokens {
  user: Pick<User, 'id' | 'phoneNumber' | 'role'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly deviceService: DeviceService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async sendCode(phoneNumber: string): Promise<{ cooldownSeconds: number }> {
    return this.otpService.sendCode(phoneNumber);
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    await this.otpService.verifyCode(input.phoneNumber, input.code);

    // First successful OTP verification for a phone number provisions the
    // account (role defaults to LISTENER). The invite-only cap and
    // waitlist are not enforced here — that gate belongs to the
    // invitation milestone, which does not exist yet.
    const user = await this.prisma.user.upsert({
      where: { phoneNumber: input.phoneNumber },
      create: { phoneNumber: input.phoneNumber },
      update: {},
    });

    const device = await this.deviceService.identifyDevice({
      userId: user.id,
      fingerprint: input.deviceFingerprint,
      platform: input.devicePlatform,
      label: input.deviceLabel,
    });

    const tokens = await this.tokenService.issueTokens(user.id, device.id, user.role);

    await this.auditService.record({
      eventType: 'LOGIN',
      actorUserId: user.id,
      metadata: { deviceId: device.id },
    });

    return {
      ...tokens,
      user: { id: user.id, phoneNumber: user.phoneNumber, role: user.role },
    };
  }

  async refresh(refreshToken: string): Promise<IssuedTokens> {
    return this.tokenService.rotateTokens(refreshToken);
  }

  async logout(userId: string, deviceId: string): Promise<void> {
    await this.deviceService.revokeDevice(deviceId, userId);
    await this.auditService.record({
      eventType: 'LOGOUT',
      actorUserId: userId,
      metadata: { deviceId },
    });
  }

  async me(userId: string): Promise<Pick<User, 'id' | 'phoneNumber' | 'role'>> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, phoneNumber: user.phoneNumber, role: user.role };
  }
}
