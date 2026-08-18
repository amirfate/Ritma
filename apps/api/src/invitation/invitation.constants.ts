/** Global cap on total registered beta users, enforced transactionally. */
export const MAX_BETA_USERS = 100;

/** Maximum number of invitations a single user may create. */
export const MAX_INVITATIONS_PER_INVITER = 10;

/** Entropy (in bytes) backing each invitation code — 160 bits. */
export const INVITATION_CODE_BYTES = 20;

/**
 * Fixed key for the global beta-capacity advisory lock
 * (`pg_advisory_xact_lock`). Every registration transaction takes this lock
 * before counting users, so the count-then-insert is fully serialized
 * across concurrent requests regardless of which invitation code is used.
 * Arbitrary constant, scoped to this feature only.
 */
export const BETA_CAPACITY_LOCK_KEY = 727_003;
