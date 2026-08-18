import { Module } from '@nestjs/common';

import { InvitationService } from './invitation.service';

/**
 * The invitation domain (creation, validation, redemption). Deliberately
 * has no controller of its own: the authenticated endpoints
 * (`POST /invitations`, `GET /invitations`) need `JwtAuthGuard`, which
 * depends on `TokenService` from `AuthModule` — rather than a circular
 * module import, `InvitationController` lives in `AuthModule`, which
 * imports this module for `InvitationService`.
 */
@Module({
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
