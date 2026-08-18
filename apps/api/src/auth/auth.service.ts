import { Injectable } from '@nestjs/common';
import { type User } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { InvitationRequiredError } from '../invitation/invitation.errors';
import { InvitationService } from '../invitation/invitation.service';
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
  /** Required only when `phoneNumber` has no existing account. */
  invitationCode?: string;
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
    private readonly invitationService: InvitationService,
  ) {}

  async sendCode(phoneNumber: string): Promise<{ cooldownSeconds: number }> {
    return this.otpService.sendCode(phoneNumber);
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    await this.otpService.verifyCode(input.phoneNumber, input.code);

    let user = await this.prisma.user.findUnique({ where: { phoneNumber: input.phoneNumber } });

    if (!user) {
      // First successful OTP verification for a phone number with no
      // existing account is a registration, not a login — the beta is
      // invite-only, so it requires a valid, unconsumed invitation. The
      // invitation is validated and consumed atomically with user
      // creation (see InvitationService.redeemForRegistration) so
      // concurrent registrations can never double-spend a code or push
      // the beta population past its cap.
      if (!input.invitationCode) {
        throw new InvitationRequiredError();
      }
      const { user: registeredUser } = await this.invitationService.redeemForRegistration(
        input.invitationCode,
        input.phoneNumber,
      );
      user = registeredUser;
    }

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
