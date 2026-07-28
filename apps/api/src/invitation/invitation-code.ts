import { randomBytes } from 'node:crypto';

import { INVITATION_CODE_BYTES } from './invitation.constants';

/** A cryptographically secure, unpredictable, URL-safe invitation code. */
export function generateInvitationCode(): string {
  return randomBytes(INVITATION_CODE_BYTES).toString('base64url');
}
