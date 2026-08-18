import { createHash, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { parseDurationMs, parseDurationSeconds } from './duration';

export interface AccessTokenPayload {
  sub: string;
  deviceId: string;
  role: UserRole;
  type: 'access';
  /** Unique per issuance, so two tokens signed within the same second never collide. */
  jti: string;
}

export interface RefreshTokenPayload {
  sub: string;
  deviceId: string;
  type: 'refresh';
  /** Unique per issuance, so two tokens signed within the same second never collide. */
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issues, rotates, and verifies the JWT access token and refresh token
 * pair for a device/session. The access token is a plain, stateless JWT.
 * The refresh token is also a signed JWT (so its authenticity and
 * expiry are self-verifiable), but a hash of it is additionally stored on
 * the owning `Device` row so it can be revoked before its natural
 * expiry (on logout, or when the device itself is revoked).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokens(userId: string, deviceId: string, role: UserRole): Promise<IssuedTokens> {
    const accessTtl = this.configService.getOrThrow<string>('JWT_ACCESS_TTL');
    const refreshTtl = this.configService.getOrThrow<string>('JWT_REFRESH_TTL');

    const accessPayload: AccessTokenPayload = {
      sub: userId,
      deviceId,
      role,
      type: 'access',
      jti: randomUUID(),
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: parseDurationSeconds(accessTtl),
    });

    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      deviceId,
      type: 'refresh',
      jti: randomUUID(),
    };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: parseDurationSeconds(refreshTtl),
    });

    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        refreshTokenHash: hashRefreshToken(refreshToken),
        refreshTokenExpiresAt: new Date(Date.now() + parseDurationMs(refreshTtl)),
      },
    });

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /**
   * Verifies a refresh token's signature and expiry, then confirms it is
   * still the current, non-revoked token for its device (rejecting reused
   * or rotated-out tokens) before rotating in a fresh pair.
   */
  async rotateTokens(refreshToken: string): Promise<IssuedTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const device = await this.prisma.device.findUnique({
      where: { id: payload.deviceId },
      include: { user: true },
    });

    if (
      !device ||
      device.revokedAt ||
      !device.refreshTokenHash ||
      device.refreshTokenHash !== hashRefreshToken(refreshToken) ||
      !device.refreshTokenExpiresAt ||
      device.refreshTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    return this.issueTokens(device.userId, device.id, device.user.role);
  }
}
