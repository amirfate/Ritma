import { randomUUID } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';

const TEST_ENV: Record<string, string> = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_REFRESH_TTL: '30d',
};

function fakeConfigService(): ConfigService {
  return {
    getOrThrow: <T>(key: string): T => {
      const value = TEST_ENV[key];
      if (value === undefined) {
        throw new Error(`Missing test config value for ${key}`);
      }
      return value as T;
    },
  } as unknown as ConfigService;
}

describe('TokenService', () => {
  let prisma: PrismaService;
  let tokenService: TokenService;
  let userId: string;
  let deviceId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    tokenService = new TokenService(new JwtService({}), fakeConfigService(), prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { phoneNumber: `+9892${randomUUID().replace(/\D/g, '').slice(0, 8)}` },
    });
    userId = user.id;
    const device = await prisma.device.create({
      data: { userId, fingerprint: 'device-a', platform: 'android' },
    });
    deviceId = device.id;
  });

  it('issues a verifiable access token and stores a hashed refresh token', async () => {
    const tokens = await tokenService.issueTokens(userId, deviceId, 'LISTENER');

    const payload = await tokenService.verifyAccessToken(tokens.accessToken);
    expect(payload.sub).toBe(userId);
    expect(payload.deviceId).toBe(deviceId);
    expect(payload.role).toBe('LISTENER');

    const device = await prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    expect(device.refreshTokenHash).not.toBeNull();
    expect(device.refreshTokenHash).not.toBe(tokens.refreshToken);
  });

  it('rejects a garbage access token', async () => {
    await expect(tokenService.verifyAccessToken('not-a-jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates a valid refresh token into a fresh pair', async () => {
    const first = await tokenService.issueTokens(userId, deviceId, 'LISTENER');

    const rotated = await tokenService.rotateTokens(first.refreshToken);
    expect(rotated.accessToken).not.toBe(first.accessToken);
    expect(rotated.refreshToken).not.toBe(first.refreshToken);

    const payload = await tokenService.verifyAccessToken(rotated.accessToken);
    expect(payload.sub).toBe(userId);
  });

  it('rejects a refresh token that has already been rotated out', async () => {
    const first = await tokenService.issueTokens(userId, deviceId, 'LISTENER');
    await tokenService.rotateTokens(first.refreshToken);

    // Reusing the original (now stale) refresh token must fail — this is
    // what makes rotation actually revoke the previous token.
    await expect(tokenService.rotateTokens(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token for a revoked device', async () => {
    const tokens = await tokenService.issueTokens(userId, deviceId, 'LISTENER');
    await prisma.device.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });

    await expect(tokenService.rotateTokens(tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
