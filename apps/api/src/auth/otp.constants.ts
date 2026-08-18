/** Seconds a caller must wait between two OTP send requests for the same phone number. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** How long a sent code remains valid before it must be re-requested. */
export const OTP_CODE_TTL_SECONDS = 120;

/** Failed verification attempts allowed before a temporary block is applied. */
export const OTP_MAX_ATTEMPTS = 5;

/** Duration of the temporary block once the attempt limit is exceeded. */
export const OTP_BLOCK_SECONDS = 30 * 60;

/** Number of digits in a generated OTP code. */
export const OTP_CODE_LENGTH = 5;
