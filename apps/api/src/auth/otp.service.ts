import { createHash, randomInt } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import {
  OTP_BLOCK_SECONDS,
  OTP_CODE_LENGTH,
  OTP_CODE_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
} from './otp.constants';
import { OtpBlockedError, OtpCooldownError, OtpInvalidOrExpiredError } from './otp.errors';
import { SMS_PROVIDER, type SmsProvider } from './sms/sms-provider';

function hashCode(phoneNumber: string, code: string): string {
  // A short-lived, single-use, moderate-entropy secret; a fast hash keyed
  // by the phone number is sufficient here (this is not password storage).
  return createHash('sha256').update(`${phoneNumber}:${code}`).digest('hex');
}

function generateCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  return randomInt(0, max).toString().padStart(OTP_CODE_LENGTH, '0');
}

function codeKey(phoneNumber: string): string {
  return `otp:${phoneNumber}:code`;
}

function cooldownKey(phoneNumber: string): string {
  return `otp:${phoneNumber}:cooldown`;
}

function attemptsKey(phoneNumber: string): string {
  return `otp:${phoneNumber}:attempts`;
}

function blockedKey(phoneNumber: string): string {
  return `otp:${phoneNumber}:blocked`;
}

/**
 * OTP send/verify state machine, backed by Redis so it survives across API
 * instances and expires on its own. Never persisted to Postgres — this is
 * ephemeral session state, not a domain entity.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async sendCode(phoneNumber: string): Promise<{ cooldownSeconds: number }> {
    await this.assertNotBlocked(phoneNumber);

    const cooldownRemaining = await this.redis.ttl(cooldownKey(phoneNumber));
    if (cooldownRemaining > 0) {
      throw new OtpCooldownError(cooldownRemaining);
    }

    const code = generateCode();

    // Only commit OTP state (and start the resend cooldown) once the SMS
    // has actually been sent. Otherwise a delivery failure would still
    // lock the caller out for the cooldown window despite never
    // receiving a code.
    await this.smsProvider.sendOtp(phoneNumber, code);

    await this.redis.setWithTtl(
      codeKey(phoneNumber),
      hashCode(phoneNumber, code),
      OTP_CODE_TTL_SECONDS,
    );
    await this.redis.setWithTtl(cooldownKey(phoneNumber), '1', OTP_RESEND_COOLDOWN_SECONDS);

    return { cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS };
  }

  /**
   * Verifies a submitted code. On success, clears all OTP state for the
   * phone number so a stale code cannot be replayed. On failure, tracks
   * the attempt and applies the temporary block once the limit is
   * exceeded.
   */
  async verifyCode(phoneNumber: string, submittedCode: string): Promise<void> {
    await this.assertNotBlocked(phoneNumber);

    const storedHash = await this.redis.get(codeKey(phoneNumber));
    if (!storedHash) {
      throw new OtpInvalidOrExpiredError();
    }

    if (storedHash !== hashCode(phoneNumber, submittedCode)) {
      await this.registerFailedAttempt(phoneNumber);
      return;
    }

    await this.redis.delete(
      codeKey(phoneNumber),
      cooldownKey(phoneNumber),
      attemptsKey(phoneNumber),
    );
  }

  private async assertNotBlocked(phoneNumber: string): Promise<void> {
    const blockedRemaining = await this.redis.ttl(blockedKey(phoneNumber));
    if (blockedRemaining > 0) {
      throw new OtpBlockedError(blockedRemaining);
    }
  }

  private async registerFailedAttempt(phoneNumber: string): Promise<never> {
    const attempts = await this.redis.incrementWithTtl(attemptsKey(phoneNumber), OTP_BLOCK_SECONDS);

    if (attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.delete(codeKey(phoneNumber), attemptsKey(phoneNumber));
      await this.redis.setWithTtl(blockedKey(phoneNumber), '1', OTP_BLOCK_SECONDS);
      throw new OtpBlockedError(OTP_BLOCK_SECONDS);
    }

    throw new OtpInvalidOrExpiredError(OTP_MAX_ATTEMPTS - attempts);
  }
}
