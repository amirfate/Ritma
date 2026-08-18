/** Injection token for the active {@link SmsProvider} implementation. */
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/**
 * Abstraction over the OTP SMS delivery channel. Keeping this as an
 * interface lets tests substitute a fake provider instead of calling a
 * real SMS gateway.
 */
export interface SmsProvider {
  sendOtp(phoneNumber: string, code: string): Promise<void>;
}
