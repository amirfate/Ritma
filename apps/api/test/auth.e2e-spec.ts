import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { type App } from 'supertest/types';

import { configureApp } from '../src/app.config';
import { AppModule } from '../src/app.module';
import { SMS_PROVIDER, type SmsProvider } from '../src/auth/sms/sms-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { createInvitationCode, randomPhoneNumber, seedRegisteredUser } from './fixtures';

class FakeSmsProvider implements SmsProvider {
  public sentCodes = new Map<string, string>();

  sendOtp(phoneNumber: string, code: string): Promise<void> {
    this.sentCodes.set(phoneNumber, code);
    return Promise.resolve();
  }
}

interface VerifyPhoneNumberResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; phoneNumber: string; role: string };
}

async function verifyPhoneNumber(
  app: INestApplication,
  smsProvider: FakeSmsProvider,
  phoneNumber: string,
  device: { fingerprint: string; platform: string },
  invitationCode?: string,
): Promise<VerifyPhoneNumberResult> {
  await request(app.getHttpServer() as App)
    .post('/auth/send-code')
    .send({ phoneNumber })
    .expect(200);

  const code = smsProvider.sentCodes.get(phoneNumber);
  if (!code) {
    throw new Error('Fake SMS provider did not capture a code');
  }

  const response = await request(app.getHttpServer() as App)
    .post('/auth/verify')
    .send({
      phoneNumber,
      code,
      deviceFingerprint: device.fingerprint,
      devicePlatform: device.platform,
      ...(invitationCode ? { invitationCode } : {}),
    })
    .expect(200);

  return response.body as VerifyPhoneNumberResult;
}

/**
 * Every first-time registration requires a valid invitation. Seeds a
 * registered "inviter" directly (bypassing OTP/invitations — see
 * `fixtures.ts` for why) and has it create one invitation through the real
 * API, ready for a new phone number to redeem.
 */
async function issueInvitation(app: INestApplication): Promise<string> {
  const inviter = await seedRegisteredUser(app);
  return createInvitationCode(app, inviter.accessToken);
}

/**
 * Each test gets its own app instance so in-memory state the throttler
 * guard keeps for the process lifetime (request counts per IP) never
 * leaks between tests. Real traffic is spread over time; a fast test
 * suite hitting the same rate-limited endpoint from many `it()` blocks in
 * one shared app is not.
 */
async function createTestApp(): Promise<{ app: INestApplication; smsProvider: FakeSmsProvider }> {
  const smsProvider = new FakeSmsProvider();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(SMS_PROVIDER)
    .useValue(smsProvider)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, smsProvider };
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let smsProvider: FakeSmsProvider;

  afterEach(async () => {
    await app.close();
  });

  it('completes the full send-code -> verify -> me -> refresh -> logout flow', async () => {
    ({ app, smsProvider } = await createTestApp());
    const phoneNumber = randomPhoneNumber();
    const invitationCode = await issueInvitation(app);

    const { accessToken, refreshToken, user } = await verifyPhoneNumber(
      app,
      smsProvider,
      phoneNumber,
      {
        fingerprint: 'e2e-device-1',
        platform: 'android',
      },
      invitationCode,
    );

    expect(user.phoneNumber).toBe(phoneNumber);
    expect(user.role).toBe('LISTENER');

    const meResponse = await request(app.getHttpServer() as App)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meResponse.body).toMatchObject({ id: user.id, phoneNumber });

    const refreshResponse = await request(app.getHttpServer() as App)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    const rotated = refreshResponse.body as { accessToken: string; refreshToken: string };
    expect(rotated.accessToken).not.toBe(accessToken);

    // The original refresh token is now rotated out and must be rejected.
    await request(app.getHttpServer() as App)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    await request(app.getHttpServer() as App)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${rotated.accessToken}`)
      .expect(204);

    // The (rotated) refresh token is invalidated by logout.
    await request(app.getHttpServer() as App)
      .post('/auth/refresh')
      .send({ refreshToken: rotated.refreshToken })
      .expect(401);
  });

  it('rejects /auth/me without a bearer token', async () => {
    ({ app, smsProvider } = await createTestApp());
    await request(app.getHttpServer() as App)
      .get('/auth/me')
      .expect(401);
  });

  it('rejects verification with an incorrect code', async () => {
    ({ app, smsProvider } = await createTestApp());
    const phoneNumber = randomPhoneNumber();

    await request(app.getHttpServer() as App)
      .post('/auth/send-code')
      .send({ phoneNumber })
      .expect(200);

    await request(app.getHttpServer() as App)
      .post('/auth/verify')
      .send({
        phoneNumber,
        code: '00000',
        deviceFingerprint: 'e2e-device-x',
        devicePlatform: 'android',
      })
      .expect(400);
  });

  it('rejects a first-time registration with no invitation code', async () => {
    ({ app, smsProvider } = await createTestApp());
    const phoneNumber = randomPhoneNumber();

    await request(app.getHttpServer() as App)
      .post('/auth/send-code')
      .send({ phoneNumber })
      .expect(200);
    const code = smsProvider.sentCodes.get(phoneNumber);

    await request(app.getHttpServer() as App)
      .post('/auth/verify')
      .send({
        phoneNumber,
        code,
        deviceFingerprint: 'e2e-device-no-invite',
        devicePlatform: 'android',
      })
      .expect(400);

    const account = await app.get(PrismaService).user.findUnique({ where: { phoneNumber } });
    expect(account).toBeNull();
  });

  it('revokes the oldest device when a third device logs in for the same user', async () => {
    ({ app, smsProvider } = await createTestApp());
    const prisma = app.get(PrismaService);
    const phoneNumber = randomPhoneNumber();
    const invitationCode = await issueInvitation(app);

    const first = await verifyPhoneNumber(
      app,
      smsProvider,
      phoneNumber,
      { fingerprint: 'e2e-device-a', platform: 'android' },
      invitationCode,
    );
    // Returning-user logins on the same (now-registered) phone number need
    // no invitation code.
    await verifyPhoneNumber(app, smsProvider, phoneNumber, {
      fingerprint: 'e2e-device-b',
      platform: 'android',
    });
    await verifyPhoneNumber(app, smsProvider, phoneNumber, {
      fingerprint: 'e2e-device-c',
      platform: 'android',
    });

    const devices = await prisma.device.findMany({ where: { userId: first.user.id } });
    expect(devices).toHaveLength(3);
    expect(devices.filter((device) => !device.revokedAt)).toHaveLength(2);
    expect(
      devices.find((device) => device.fingerprint === 'e2e-device-a')?.revokedAt,
    ).not.toBeNull();
  });

  it('never writes the OTP code, invitation code, or issued tokens to the application log', async () => {
    ({ app, smsProvider } = await createTestApp());
    const invitationCode = await issueInvitation(app);
    const logLines: string[] = [];
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      logLines.push(String(chunk));
      return true;
    });

    const phoneNumber = randomPhoneNumber();
    let capturedCode: string | undefined;
    let capturedTokens: { accessToken: string; refreshToken: string } | undefined;
    try {
      await request(app.getHttpServer() as App)
        .post('/auth/send-code')
        .send({ phoneNumber })
        .expect(200);

      capturedCode = smsProvider.sentCodes.get(phoneNumber);
      if (!capturedCode) {
        throw new Error('Fake SMS provider did not capture a code');
      }

      const verifyResponse = await request(app.getHttpServer() as App)
        .post('/auth/verify')
        .send({
          phoneNumber,
          code: capturedCode,
          deviceFingerprint: 'e2e-device-log-test',
          devicePlatform: 'android',
          invitationCode,
        })
        .expect(200);
      capturedTokens = verifyResponse.body as { accessToken: string; refreshToken: string };
    } finally {
      writeSpy.mockRestore();
    }

    if (!capturedTokens) {
      throw new Error('Verify did not return tokens');
    }

    const combinedLog = logLines.join('\n');
    expect(combinedLog).not.toContain(capturedCode);
    expect(combinedLog).not.toContain(invitationCode);
    expect(combinedLog).not.toContain(capturedTokens.accessToken);
    expect(combinedLog).not.toContain(capturedTokens.refreshToken);
  });

  it('rate limits repeated requests to a single endpoint', async () => {
    ({ app, smsProvider } = await createTestApp());
    const responses: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const response = await request(app.getHttpServer() as App).get('/health');
      responses.push(response.status);
    }

    expect(responses).toContain(429);
  });
});
