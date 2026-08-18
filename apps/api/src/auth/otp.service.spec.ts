import { Redis } from 'ioredis';

import { RedisService } from '../redis/redis.service';
import { OTP_MAX_ATTEMPTS } from './otp.constants';
import { OtpBlockedError, OtpCooldownError, OtpInvalidOrExpiredError } from './otp.errors';
import { OtpService } from './otp.service';
import { type SmsProvider } from './sms/sms-provider';

class FakeSmsProvider implements SmsProvider {
  public sentCodes: { phoneNumber: string; code: string }[] = [];
  public shouldFail = false;

  sendOtp(phoneNumber: string, code: string): Promise<void> {
    if (this.shouldFail) {
      return Promise.reject(new Error('simulated delivery failure'));
    }
    this.sentCodes.push({ phoneNumber, code });
    return Promise.resolve();
  }
}

describe('OtpService', () => {
  const phoneNumber = '+989120000001';
  const keys = [
    `otp:${phoneNumber}:code`,
    `otp:${phoneNumber}:cooldown`,
    `otp:${phoneNumber}:attempts`,
    `otp:${phoneNumber}:blocked`,
  ];

  let redisClient: Redis;
  let redisService: RedisService;
  let smsProvider: FakeSmsProvider;
  let otpService: OtpService;

  beforeAll(() => {
    redisClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    redisService = new RedisService(redisClient);
  });

  afterAll(() => {
    redisClient.disconnect();
  });

  beforeEach(async () => {
    smsProvider = new FakeSmsProvider();
    otpService = new OtpService(redisService, smsProvider);
    await redisClient.del(...keys);
  });

  afterEach(async () => {
    await redisClient.del(...keys);
  });

  it('sends a code and enforces the resend cooldown', async () => {
    const result = await otpService.sendCode(phoneNumber);
    expect(result.cooldownSeconds).toBe(60);
    expect(smsProvider.sentCodes).toHaveLength(1);

    await expect(otpService.sendCode(phoneNumber)).rejects.toBeInstanceOf(OtpCooldownError);
  });

  it('does not start the cooldown when SMS delivery fails', async () => {
    smsProvider.shouldFail = true;

    await expect(otpService.sendCode(phoneNumber)).rejects.toThrow('simulated delivery failure');

    smsProvider.shouldFail = false;
    // If delivery failure had incorrectly started the cooldown, this
    // second attempt would be rejected with OtpCooldownError.
    const result = await otpService.sendCode(phoneNumber);
    expect(result.cooldownSeconds).toBe(60);
  });

  it('verifies the correct code and clears state so it cannot be replayed', async () => {
    await otpService.sendCode(phoneNumber);
    const { code } = smsProvider.sentCodes[0]!;

    await expect(otpService.verifyCode(phoneNumber, code)).resolves.toBeUndefined();
    await expect(otpService.verifyCode(phoneNumber, code)).rejects.toBeInstanceOf(
      OtpInvalidOrExpiredError,
    );
  });

  it('rejects an incorrect code and reports attempts remaining', async () => {
    await otpService.sendCode(phoneNumber);

    await expect(otpService.verifyCode(phoneNumber, '00000')).rejects.toMatchObject({
      response: { attemptsRemaining: OTP_MAX_ATTEMPTS - 1 },
    });
  });

  it('blocks the phone number for 30 minutes after 5 failed attempts', async () => {
    await otpService.sendCode(phoneNumber);

    for (let attempt = 1; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      await expect(otpService.verifyCode(phoneNumber, '00000')).rejects.toBeInstanceOf(
        OtpInvalidOrExpiredError,
      );
    }

    // The 5th failed attempt trips the block.
    await expect(otpService.verifyCode(phoneNumber, '00000')).rejects.toBeInstanceOf(
      OtpBlockedError,
    );

    // Further sends and verifies are rejected while blocked, even with
    // the correct code.
    await expect(otpService.sendCode(phoneNumber)).rejects.toBeInstanceOf(OtpBlockedError);
    await expect(otpService.verifyCode(phoneNumber, '00000')).rejects.toBeInstanceOf(
      OtpBlockedError,
    );
  });

  it('does not reset the attempt counter when a new code is requested', async () => {
    await otpService.sendCode(phoneNumber);
    await expect(otpService.verifyCode(phoneNumber, '00000')).rejects.toMatchObject({
      response: { attemptsRemaining: OTP_MAX_ATTEMPTS - 1 },
    });

    // Requesting a fresh code must not reset the attempt counter, or the
    // attempt limit could be bypassed by simply resending.
    await redisClient.del(`otp:${phoneNumber}:cooldown`);
    await otpService.sendCode(phoneNumber);

    await expect(otpService.verifyCode(phoneNumber, '00000')).rejects.toMatchObject({
      response: { attemptsRemaining: OTP_MAX_ATTEMPTS - 2 },
    });
  });
});
