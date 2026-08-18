import { Injectable, Optional } from '@nestjs/common';
import { type Invitation, type User } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { generateInvitationCode } from './invitation-code';
import {
  BETA_CAPACITY_LOCK_KEY,
  MAX_BETA_USERS,
  MAX_INVITATIONS_PER_INVITER,
} from './invitation.constants';
import {
  BetaWaitlistedError,
  InvitationInvalidError,
  InvitationQuotaExceededError,
} from './invitation.errors';

export interface RedemptionResult {
  user: User;
}

/**
 * Owns the full lifecycle of an invitation: creation (with the
 * per-inviter quota), the read-only pre-check the client runs before
 * asking for a phone number, and the atomic redemption that runs once OTP
 * verification has already succeeded for a phone number with no existing
 * account.
 */
@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    /**
     * Overridable only for tests, which need a small cap to exercise
     * "capacity reached" behavior without creating 100 real rows. Nest
     * has no provider for a bare `number`, so `@Optional()` makes it
     * inject `undefined` in the real app, which falls through to the
     * locked default.
     */
    @Optional() private readonly maxBetaUsers: number = MAX_BETA_USERS,
    @Optional() private readonly maxInvitationsPerInviter: number = MAX_INVITATIONS_PER_INVITER,
  ) {}

  /**
   * Creating an invitation and counting an inviter's existing invitations
   * must be serialized per-inviter, or two concurrent requests could both
   * observe 9 existing invitations and both create a 10th (and 11th). The
   * advisory lock is keyed by a hash of the inviter's id, so unrelated
   * inviters never block each other.
   */
  async createInvitation(inviterId: string, inviteePhoneNumber?: string): Promise<Invitation> {
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inviterId}))`;

      const existingCount = await tx.invitation.count({ where: { inviterId } });
      if (existingCount >= this.maxInvitationsPerInviter) {
        throw new InvitationQuotaExceededError();
      }

      return tx.invitation.create({
        data: {
          code: generateInvitationCode(),
          inviterId,
          inviteePhoneNumber,
        },
      });
    });

    await this.auditService.record({
      eventType: 'INVITATION_CREATED',
      actorUserId: inviterId,
      metadata: { invitationId: invitation.id },
    });

    return invitation;
  }

  /**
   * Read-only check used before the invitee is asked for a phone number.
   * Never mutates state — the invitation is only actually consumed by
   * `redeemForRegistration`, once OTP verification has also succeeded.
   */
  async validateInvitation(code: string): Promise<{ valid: boolean }> {
    const invitation = await this.prisma.invitation.findUnique({ where: { code } });
    return { valid: invitation !== null && invitation.status === 'PENDING' };
  }

  async listForInviter(inviterId: string): Promise<Invitation[]> {
    return this.prisma.invitation.findMany({
      where: { inviterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * The atomic core of Milestone 3. Called only after OTP verification has
   * already succeeded for a phone number with no existing account.
   * Re-validates the invitation (it may have been redeemed by someone else
   * since the earlier read-only check), enforces the global beta cap, and
   * — all inside one transaction guarded by a global advisory lock —
   * provisions the user and consumes the invitation together. The lock is
   * global (not per-invitation) because it must serialize the *user count*
   * across every concurrent registration, not just concurrent attempts on
   * the same code; at beta scale (max 100 users) a single global mutex
   * around this critical section has no meaningful performance cost.
   *
   * If OTP verification fails, this method is never called, so a failed
   * registration never touches the invitation.
   *
   * Throws `BetaWaitlistedError` (not a plain failure) when the invitation
   * was genuine but the beta was already at capacity — the invitation is
   * still consumed (moved to WAITLISTED) so it cannot be retried.
   */
  async redeemForRegistration(code: string, phoneNumber: string): Promise<RedemptionResult> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BETA_CAPACITY_LOCK_KEY})`;

        const invitation = await tx.invitation.findUnique({ where: { code } });
        if (invitation?.status !== 'PENDING') {
          throw new InvitationInvalidError();
        }
        if (
          invitation.inviteePhoneNumber !== null &&
          invitation.inviteePhoneNumber !== phoneNumber
        ) {
          throw new InvitationInvalidError();
        }

        const userCount = await tx.user.count();
        if (userCount >= this.maxBetaUsers) {
          await tx.invitation.update({
            where: { id: invitation.id },
            data: { status: 'WAITLISTED', inviteePhoneNumber: phoneNumber },
          });
          return { outcome: 'waitlisted' as const, invitationId: invitation.id };
        }

        const user = await tx.user.create({ data: { phoneNumber } });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: 'ACCEPTED',
            redeemedById: user.id,
            redeemedAt: new Date(),
            inviteePhoneNumber: phoneNumber,
          },
        });

        return { outcome: 'registered' as const, user, invitationId: invitation.id };
      });

      if (result.outcome === 'waitlisted') {
        await this.auditService.record({
          eventType: 'INVITATION_REJECTED',
          metadata: { invitationId: result.invitationId, reason: 'beta_capacity_reached' },
        });
        throw new BetaWaitlistedError();
      }

      await this.auditService.record({
        eventType: 'INVITATION_ACCEPTED',
        actorUserId: result.user.id,
        metadata: { invitationId: result.invitationId },
      });

      return { user: result.user };
    } catch (error) {
      if (error instanceof InvitationInvalidError) {
        await this.auditService.record({
          eventType: 'INVITATION_REJECTED',
          metadata: { reason: 'invalid_or_used_code' },
        });
      }
      throw error;
    }
  }
}
