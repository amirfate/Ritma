import { randomUUID } from 'node:crypto';

import { type User } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_BETA_USERS, MAX_INVITATIONS_PER_INVITER } from './invitation.constants';
import { BetaWaitlistedError, InvitationInvalidError } from './invitation.errors';
import { InvitationService } from './invitation.service';

/**
 * Every test in this file except the "beta capacity" describe block below
 * exercises invitation lifecycle behavior that has nothing to do with the
 * capacity boundary itself (single-use, quota, code shape, audit logging).
 * Those tests use a huge cap so they never depend on how many `User` rows
 * happen to already exist in the shared local/CI database — only the
 * capacity-specific tests construct their own instance with a small,
 * explicit, deterministic cap to test the boundary itself.
 */
const EFFECTIVELY_UNLIMITED = 1_000_000;

function randomPhoneNumber(): string {
  return `+9891${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
}

async function createUser(prisma: PrismaService): Promise<User> {
  return prisma.user.create({ data: { phoneNumber: randomPhoneNumber() } });
}

describe('invitation.constants', () => {
  // Pinned separately from the behavioral tests below, which deliberately
  // override these values so they stay deterministic regardless of how
  // many `User`/`Invitation` rows already exist in the database.
  it('locks the beta capacity and per-inviter quota to the spec values', () => {
    expect(MAX_BETA_USERS).toBe(100);
    expect(MAX_INVITATIONS_PER_INVITER).toBe(10);
  });
});

describe('InvitationService', () => {
  let prisma: PrismaService;
  let auditService: AuditService;
  let invitationService: InvitationService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    auditService = new AuditService(prisma);
    invitationService = new InvitationService(prisma, auditService, EFFECTIVELY_UNLIMITED);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('createInvitation', () => {
    it('creates a cryptographically random, single-use, PENDING invitation', async () => {
      const inviter = await createUser(prisma);

      const invitation = await invitationService.createInvitation(inviter.id);

      expect(invitation.inviterId).toBe(inviter.id);
      expect(invitation.status).toBe('PENDING');
      expect(invitation.code).toMatch(/^[A-Za-z0-9_-]{20,}$/);

      const auditLog = await prisma.auditLog.findFirst({
        where: { eventType: 'INVITATION_CREATED', actorUserId: inviter.id },
      });
      expect(auditLog).not.toBeNull();
    });

    it('generates unpredictable, non-sequential codes', async () => {
      const inviter = await createUser(prisma);

      const first = await invitationService.createInvitation(inviter.id);
      const second = await invitationService.createInvitation(inviter.id);

      expect(first.code).not.toBe(second.code);
      // No shared prefix that would suggest a sequential/incrementing scheme.
      expect(first.code.slice(0, 6)).not.toBe(second.code.slice(0, 6));
    });

    it('binds an invitee phone number when provided', async () => {
      const inviter = await createUser(prisma);
      const inviteePhoneNumber = randomPhoneNumber();

      const invitation = await invitationService.createInvitation(inviter.id, inviteePhoneNumber);

      expect(invitation.inviteePhoneNumber).toBe(inviteePhoneNumber);
    });

    it('rejects the 11th invitation from the same inviter', async () => {
      const inviter = await createUser(prisma);

      for (let i = 0; i < 10; i += 1) {
        await invitationService.createInvitation(inviter.id);
      }

      await expect(invitationService.createInvitation(inviter.id)).rejects.toMatchObject({
        status: 403,
      });

      const count = await prisma.invitation.count({ where: { inviterId: inviter.id } });
      expect(count).toBe(10);
    });

    it('never lets concurrent requests push an inviter past 10 invitations', async () => {
      const inviter = await createUser(prisma);

      // 9 already exist — exactly one quota slot remains.
      for (let i = 0; i < 9; i += 1) {
        await invitationService.createInvitation(inviter.id);
      }

      const attempts = await Promise.allSettled([
        invitationService.createInvitation(inviter.id),
        invitationService.createInvitation(inviter.id),
        invitationService.createInvitation(inviter.id),
      ]);

      const fulfilled = attempts.filter((result) => result.status === 'fulfilled');
      const rejected = attempts.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);

      const count = await prisma.invitation.count({ where: { inviterId: inviter.id } });
      expect(count).toBe(10);
    });
  });

  describe('validateInvitation', () => {
    it('reports a freshly created invitation as valid', async () => {
      const inviter = await createUser(prisma);
      const invitation = await invitationService.createInvitation(inviter.id);

      await expect(invitationService.validateInvitation(invitation.code)).resolves.toEqual({
        valid: true,
      });
    });

    it('reports a nonexistent code as invalid', async () => {
      await expect(invitationService.validateInvitation('does-not-exist')).resolves.toEqual({
        valid: false,
      });
    });

    it('reports an already-consumed code as invalid', async () => {
      const inviter = await createUser(prisma);
      const invitation = await invitationService.createInvitation(inviter.id);
      await invitationService.redeemForRegistration(invitation.code, randomPhoneNumber());

      await expect(invitationService.validateInvitation(invitation.code)).resolves.toEqual({
        valid: false,
      });
    });

    it('never consumes the invitation — it is read-only', async () => {
      const inviter = await createUser(prisma);
      const invitation = await invitationService.createInvitation(inviter.id);

      await invitationService.validateInvitation(invitation.code);
      await invitationService.validateInvitation(invitation.code);

      const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
      expect(stored.status).toBe('PENDING');
    });
  });

  describe('listForInviter', () => {
    it('returns only the calling inviter’s own invitations', async () => {
      const inviterA = await createUser(prisma);
      const inviterB = await createUser(prisma);
      await invitationService.createInvitation(inviterA.id);
      await invitationService.createInvitation(inviterB.id);

      const forA = await invitationService.listForInviter(inviterA.id);
      expect(forA).toHaveLength(1);
      expect(forA[0]?.inviterId).toBe(inviterA.id);
    });
  });

  describe('redeemForRegistration', () => {
    it('provisions a user and marks the invitation ACCEPTED', async () => {
      const inviter = await createUser(prisma);
      const invitation = await invitationService.createInvitation(inviter.id);
      const phoneNumber = randomPhoneNumber();

      const { user } = await invitationService.redeemForRegistration(invitation.code, phoneNumber);

      expect(user.phoneNumber).toBe(phoneNumber);

      const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
      expect(stored.status).toBe('ACCEPTED');
      expect(stored.redeemedById).toBe(user.id);
      expect(stored.redeemedAt).not.toBeNull();

      const auditLog = await prisma.auditLog.findFirst({
        where: { eventType: 'INVITATION_ACCEPTED', actorUserId: user.id },
      });
      expect(auditLog).not.toBeNull();
    });

    it('rejects an invalid (nonexistent) code and creates no user', async () => {
      const countBefore = await prisma.user.count();

      await expect(
        invitationService.redeemForRegistration('does-not-exist', randomPhoneNumber()),
      ).rejects.toBeInstanceOf(InvitationInvalidError);

      const countAfter = await prisma.user.count();
      expect(countAfter).toBe(countBefore);

      const auditLog = await prisma.auditLog.findFirst({
        where: { eventType: 'INVITATION_REJECTED' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.metadata).toMatchObject({ reason: 'invalid_or_used_code' });
    });

    it('rejects reuse of an already-consumed invitation and creates no second user', async () => {
      const inviter = await createUser(prisma);
      const invitation = await invitationService.createInvitation(inviter.id);
      const firstPhone = randomPhoneNumber();
      const secondPhone = randomPhoneNumber();

      const { user: firstUser } = await invitationService.redeemForRegistration(
        invitation.code,
        firstPhone,
      );

      await expect(
        invitationService.redeemForRegistration(invitation.code, secondPhone),
      ).rejects.toBeInstanceOf(InvitationInvalidError);

      const secondAccount = await prisma.user.findUnique({ where: { phoneNumber: secondPhone } });
      expect(secondAccount).toBeNull();

      const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
      expect(stored.redeemedById).toBe(firstUser.id);
    });

    it('rejects redemption with a phone number different from the one the invitation is bound to', async () => {
      const inviter = await createUser(prisma);
      const boundPhone = randomPhoneNumber();
      const invitation = await invitationService.createInvitation(inviter.id, boundPhone);

      await expect(
        invitationService.redeemForRegistration(invitation.code, randomPhoneNumber()),
      ).rejects.toBeInstanceOf(InvitationInvalidError);

      const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
      expect(stored.status).toBe('PENDING');
    });

    it('two concurrent redemptions of the same invitation: exactly one succeeds', async () => {
      const inviter = await createUser(prisma);
      const invitation = await invitationService.createInvitation(inviter.id);

      const attempts = await Promise.allSettled([
        invitationService.redeemForRegistration(invitation.code, randomPhoneNumber()),
        invitationService.redeemForRegistration(invitation.code, randomPhoneNumber()),
      ]);

      const fulfilled = attempts.filter((result) => result.status === 'fulfilled');
      const rejected = attempts.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
      expect(stored.status).toBe('ACCEPTED');
    });

    it('a failed registration (invalid code) never mutates a genuine invitation', async () => {
      const inviter = await createUser(prisma);
      const untouchedInvitation = await invitationService.createInvitation(inviter.id);
      const countBefore = await prisma.user.count();

      // Simulates "OTP verification succeeded but the presented invitation
      // code was wrong" — a realistic failure mode once OTP and invitation
      // validation are decoupled steps in the same registration request.
      await expect(
        invitationService.redeemForRegistration('some-other-invalid-code', randomPhoneNumber()),
      ).rejects.toBeInstanceOf(InvitationInvalidError);

      const stored = await prisma.invitation.findUniqueOrThrow({
        where: { id: untouchedInvitation.id },
      });
      expect(stored.status).toBe('PENDING');
      expect(await prisma.user.count()).toBe(countBefore);
    });

    describe('beta capacity', () => {
      it('waitlists a genuine invitation once the cap is reached, without creating a user', async () => {
        const capacityService = new InvitationService(prisma, auditService, 0);
        const inviter = await createUser(prisma);
        const invitation = await invitationService.createInvitation(inviter.id);
        const phoneNumber = randomPhoneNumber();

        await expect(
          capacityService.redeemForRegistration(invitation.code, phoneNumber),
        ).rejects.toBeInstanceOf(BetaWaitlistedError);

        const stored = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
        expect(stored.status).toBe('WAITLISTED');
        expect(stored.redeemedById).toBeNull();

        const account = await prisma.user.findUnique({ where: { phoneNumber } });
        expect(account).toBeNull();
      });

      it('never allows concurrent registrations to exceed the cap when exactly one slot remains', async () => {
        const inviter = await createUser(prisma);
        const invitations = await Promise.all([
          invitationService.createInvitation(inviter.id),
          invitationService.createInvitation(inviter.id),
          invitationService.createInvitation(inviter.id),
        ]);

        // Computed after all fixture users (the inviter) exist, so it is
        // exactly the population the race starts from — one slot remains.
        const baseline = await prisma.user.count();
        const capacityService = new InvitationService(prisma, auditService, baseline + 1);

        const attempts = await Promise.allSettled(
          invitations.map((invitation) =>
            capacityService.redeemForRegistration(invitation.code, randomPhoneNumber()),
          ),
        );

        const registered = attempts.filter((result) => result.status === 'fulfilled');
        const waitlisted = attempts.filter(
          (result) => result.status === 'rejected' && result.reason instanceof BetaWaitlistedError,
        );
        expect(registered).toHaveLength(1);
        expect(waitlisted).toHaveLength(2);

        const finalCount = await prisma.user.count();
        expect(finalCount).toBe(baseline + 1);

        const statuses = await Promise.all(
          invitations.map((invitation) =>
            prisma.invitation
              .findUniqueOrThrow({ where: { id: invitation.id } })
              .then((row) => row.status),
          ),
        );
        expect(statuses.sort()).toEqual(['ACCEPTED', 'WAITLISTED', 'WAITLISTED']);
      });
    });
  });
});
