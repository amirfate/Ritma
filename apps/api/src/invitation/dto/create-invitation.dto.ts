import { IsOptional, Matches } from 'class-validator';

const E164_LIKE_PATTERN = /^\+?[1-9]\d{7,14}$/;

export class CreateInvitationDto {
  @IsOptional()
  @Matches(E164_LIKE_PATTERN, { message: 'inviteePhoneNumber must be a valid phone number' })
  inviteePhoneNumber?: string;
}
