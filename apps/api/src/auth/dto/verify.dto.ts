import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const E164_LIKE_PATTERN = /^\+?[1-9]\d{7,14}$/;
const OTP_CODE_PATTERN = /^\d{5}$/;

export class VerifyDto {
  @Matches(E164_LIKE_PATTERN, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber!: string;

  @Matches(OTP_CODE_PATTERN, { message: 'code must be a 5-digit numeric code' })
  code!: string;

  @IsString()
  @IsNotEmpty()
  deviceFingerprint!: string;

  /** Android app and the Dashboard's browser-based BFF login are both in scope. */
  @IsIn(['android', 'web'])
  devicePlatform!: string;

  @IsOptional()
  @IsString()
  deviceLabel?: string;

  /** Required only when `phoneNumber` has no existing account. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  invitationCode?: string;
}
