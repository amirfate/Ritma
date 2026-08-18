import { BadRequestException } from '@nestjs/common';

/** Raised when a requested track lifecycle action doesn't apply to the track's current status. */
export class InvalidTrackTransitionError extends BadRequestException {
  constructor(currentStatus: string, action: string) {
    super({
      message: `Cannot ${action} a track that is currently ${currentStatus}.`,
      currentStatus,
      action,
    });
  }
}

/** Raised when a publish attempt is missing one or more required prerequisites. */
export class PublishPrerequisitesNotMetError extends BadRequestException {
  constructor(public readonly reasons: string[]) {
    super({
      message: 'The track cannot be published until all prerequisites are met.',
      reasons,
    });
  }
}
