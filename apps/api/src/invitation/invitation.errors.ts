import { HttpException, HttpStatus } from '@nestjs/common';

import { MAX_INVITATIONS_PER_INVITER } from './invitation.constants';

export class InvitationInvalidError extends HttpException {
  constructor() {
    super(
      { message: 'The invitation code is invalid or has already been used.' },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InvitationRequiredError extends HttpException {
  constructor() {
    super({ message: 'An invitation code is required to register.' }, HttpStatus.BAD_REQUEST);
  }
}

export class InvitationQuotaExceededError extends HttpException {
  constructor() {
    super(
      { message: `You have reached the maximum of ${MAX_INVITATIONS_PER_INVITER} invitations.` },
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * Not a failure — the OTP was valid and the invitation was genuine, but the
 * beta was already at capacity, so the invitation was consumed into the
 * waitlist instead of provisioning an account. Modeled as an HttpException
 * (like the other auth flow-control states in this codebase) so the
 * controller layer stays a thin pass-through.
 */
export class BetaWaitlistedError extends HttpException {
  constructor() {
    super(
      {
        message: 'Beta capacity has been reached. You have been placed on the waitlist.',
        waitlisted: true,
      },
      HttpStatus.ACCEPTED,
    );
  }
}
