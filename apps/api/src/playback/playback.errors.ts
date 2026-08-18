import { ConflictException } from '@nestjs/common';

/** Raised when a user already has an active (unexpired, unended) playback session. */
export class ConcurrentPlaybackSessionError extends ConflictException {
  constructor() {
    super('Only one active playback session is allowed per listener at a time.');
  }
}
