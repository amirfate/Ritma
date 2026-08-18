import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type App } from 'supertest/types';

import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/auth/token.service';

export function randomPhoneNumber(): string {
  return `+9893${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
}

/**
 * Creates a fully-registered user directly via Prisma/TokenService,
 * bypassing OTP and invitation redemption entirely. Test-only: it exists
 * to break the invite-only bootstrap problem (every real registration
 * requires an invitation from an existing user, so tests need one seeded
 * account to issue the first invitations from).
 */
export async function seedRegisteredUser(
  app: INestApplication,
): Promise<{ userId: string; accessToken: string }> {
  const prisma = app.get(PrismaService);
  const tokenService = app.get(TokenService);

  const user = await prisma.user.create({ data: { phoneNumber: randomPhoneNumber() } });
  const device = await prisma.device.create({
    data: { userId: user.id, fingerprint: `seed-${randomUUID()}`, platform: 'android' },
  });
  const tokens = await tokenService.issueTokens(user.id, device.id, user.role);

  return { userId: user.id, accessToken: tokens.accessToken };
}

/** Same as `seedRegisteredUser`, but with the ADMIN role — for catalog authorization tests. */
export async function seedAdminUser(
  app: INestApplication,
): Promise<{ userId: string; accessToken: string }> {
  const prisma = app.get(PrismaService);
  const tokenService = app.get(TokenService);

  const user = await prisma.user.create({
    data: { phoneNumber: randomPhoneNumber(), role: 'ADMIN' },
  });
  const device = await prisma.device.create({
    data: { userId: user.id, fingerprint: `seed-admin-${randomUUID()}`, platform: 'android' },
  });
  const tokens = await tokenService.issueTokens(user.id, device.id, user.role);

  return { userId: user.id, accessToken: tokens.accessToken };
}

/** Creates an invitation through the real HTTP API, as any authenticated user would. */
export async function createInvitationCode(
  app: INestApplication,
  accessToken: string,
  inviteePhoneNumber?: string,
): Promise<string> {
  const response = await request(app.getHttpServer() as App)
    .post('/invitations')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(inviteePhoneNumber ? { inviteePhoneNumber } : {})
    .expect(201);

  return (response.body as { code: string }).code;
}
