import { HttpException, HttpStatus } from '@nestjs/common';

export class OtpCooldownError extends HttpException {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      {
        message: 'A code was already sent recently. Please wait before requesting another.',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class OtpBlockedError extends HttpException {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      { message: 'Too many failed attempts. Try again later.', retryAfterSeconds },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class OtpInvalidOrExpiredError extends HttpException {
  constructor(public readonly attemptsRemaining?: number) {
    super(
      { message: 'The code is incorrect, expired, or was never requested.', attemptsRemaining },
      HttpStatus.BAD_REQUEST,
    );
  }
}
