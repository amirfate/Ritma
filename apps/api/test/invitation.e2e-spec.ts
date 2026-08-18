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

/** Registers a brand-new user through the real HTTP API using a given invitation code. */
async function registerViaApi(
  app: INestApplication,
  smsProvider: FakeSmsProvider,
  invitationCode: string,
  fingerprint: string,
): Promise<{ accessToken: string; phoneNumber: string }> {
  const phoneNumber = randomPhoneNumber();

  await request(app.getHttpServer() as App)
    .post('/auth/send-code')
    .send({ phoneNumber })
    .expect(200);
  const code = smsProvider.sentCodes.get(phoneNumber);

  const response = await request(app.getHttpServer() as App)
    .post('/auth/verify')
    .send({
      phoneNumber,
      code,
      deviceFingerprint: fingerprint,
      devicePlatform: 'android',
      invitationCode,
    })
    .expect(200);

  return { accessToken: (response.body as { accessToken: string }).accessToken, phoneNumber };
}

describe('Invitations (e2e)', () => {
  let app: INestApplication;
  let smsProvider: FakeSmsProvider;

  afterEach(async () => {
    await app.close();
  });

  it('lets an authenticated user create an invitation', async () => {
    ({ app, smsProvider } = await createTestApp());
    const inviter = await seedRegisteredUser(app);

    const response = await request(app.getHttpServer() as App)
      .post('/invitations')
      .set('Authorization', `Bearer ${inviter.accessToken}`)
      .send({})
      .expect(201);

    expect(response.body).toMatchObject({ status: 'PENDING' });
    expect(typeof (response.body as { code: string }).code).toBe('string');
  });

  it('rejects invitation creation without a bearer token', async () => {
    ({ app, smsProvider } = await createTestApp());

    await request(app.getHttpServer() as App)
      .post('/invitations')
      .send({})
      .expect(401);
  });

  it('rejects an 11th invitation from the same inviter', async () => {
    ({ app, smsProvider } = await createTestApp());
    const inviter = await seedRegisteredUser(app);

    for (let i = 0; i < 10; i += 1) {
      await request(app.getHttpServer() as App)
        .post('/invitations')
        .set('Authorization', `Bearer ${inviter.accessToken}`)
        .send({})
        .expect(201);
    }

    await request(app.getHttpServer() as App)
      .post('/invitations')
      .set('Authorization', `Bearer ${inviter.accessToken}`)
      .send({})
      .expect(403);
  });

  it('validates a fresh invitation as valid, and an unknown code as invalid', async () => {
    ({ app, smsProvider } = await createTestApp());
    const inviter = await seedRegisteredUser(app);
    const code = await createInvitationCode(app, inviter.accessToken);

    await request(app.getHttpServer() as App)
      .post('/invitations/validate')
      .send({ code })
      .expect(200)
      .expect({ valid: true });

    await request(app.getHttpServer() as App)
      .post('/invitations/validate')
      .send({ code: 'this-code-does-not-exist' })
      .expect(200)
      .expect({ valid: false });
  });

  it('completes registration with a valid invitation, then rejects reuse of the same code', async () => {
    ({ app, smsProvider } = await createTestApp());
    const inviter = await seedRegisteredUser(app);
    const invitationCode = await createInvitationCode(app, inviter.accessToken);

    const first = await registerViaApi(app, smsProvider, invitationCode, 'device-first');
    expect(first.accessToken).toEqual(expect.any(String));

    // A second phone number attempting the same, now-consumed code.
    const secondPhoneNumber = randomPhoneNumber();
    await request(app.getHttpServer() as App)
      .post('/auth/send-code')
      .send({ phoneNumber: secondPhoneNumber })
      .expect(200);
    const secondOtp = smsProvider.sentCodes.get(secondPhoneNumber);

    await request(app.getHttpServer() as App)
      .post('/auth/verify')
      .send({
        phoneNumber: secondPhoneNumber,
        code: secondOtp,
        deviceFingerprint: 'device-second',
        devicePlatform: 'android',
        invitationCode,
      })
      .expect(400);

    const secondAccount = await app
      .get(PrismaService)
      .user.findUnique({ where: { phoneNumber: secondPhoneNumber } });
    expect(secondAccount).toBeNull();
  });

  it('lists only the caller’s own invitations, most recent first', async () => {
    ({ app, smsProvider } = await createTestApp());
    const inviterA = await seedRegisteredUser(app);
    const inviterB = await seedRegisteredUser(app);
    await createInvitationCode(app, inviterA.accessToken);
    await createInvitationCode(app, inviterB.accessToken);

    const response = await request(app.getHttpServer() as App)
      .get('/invitations')
      .set('Authorization', `Bearer ${inviterA.accessToken}`)
      .expect(200);

    const invitations = response.body as { id: string }[];
    expect(invitations).toHaveLength(1);
  });

  it('rejects listing invitations without a bearer token', async () => {
    ({ app, smsProvider } = await createTestApp());
    await request(app.getHttpServer() as App)
      .get('/invitations')
      .expect(401);
  });

  it('rate limits repeated invitation-validation requests', async () => {
    ({ app, smsProvider } = await createTestApp());
    const responses: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const response = await request(app.getHttpServer() as App)
        .post('/invitations/validate')
        .send({ code: 'irrelevant' });
      responses.push(response.status);
    }

    expect(responses).toContain(429);
  });

  it('two concurrent registrations against the same invitation: exactly one succeeds', async () => {
    ({ app, smsProvider } = await createTestApp());
    const inviter = await seedRegisteredUser(app);
    const invitationCode = await createInvitationCode(app, inviter.accessToken);

    const phoneA = randomPhoneNumber();
    const phoneB = randomPhoneNumber();
    await request(app.getHttpServer() as App)
      .post('/auth/send-code')
      .send({ phoneNumber: phoneA })
      .expect(200);
    await request(app.getHttpServer() as App)
      .post('/auth/send-code')
      .send({ phoneNumber: phoneB })
      .expect(200);
    const codeA = smsProvider.sentCodes.get(phoneA);
    const codeB = smsProvider.sentCodes.get(phoneB);

    const [responseA, responseB] = await Promise.all([
      request(app.getHttpServer() as App)
        .post('/auth/verify')
        .send({
          phoneNumber: phoneA,
          code: codeA,
          deviceFingerprint: 'device-race-a',
          devicePlatform: 'android',
          invitationCode,
        }),
      request(app.getHttpServer() as App)
        .post('/auth/verify')
        .send({
          phoneNumber: phoneB,
          code: codeB,
          deviceFingerprint: 'device-race-b',
          devicePlatform: 'android',
          invitationCode,
        }),
    ]);

    const statuses = [responseA.status, responseB.status].sort();
    expect(statuses).toEqual([200, 400]);

    const invitation = await app
      .get(PrismaService)
      .invitation.findUniqueOrThrow({ where: { code: invitationCode } });
    expect(invitation.status).toBe('ACCEPTED');
  });
});
