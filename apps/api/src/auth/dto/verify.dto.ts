import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

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

  /** The only platform in scope for the beta. */
  @IsIn(['android'])
  devicePlatform!: string;

  @IsOptional()
  @IsString()
  deviceLabel?: string;
}
