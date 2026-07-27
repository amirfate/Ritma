import { Matches } from 'class-validator';

const E164_LIKE_PATTERN = /^\+?[1-9]\d{7,14}$/;

export class SendCodeDto {
  @Matches(E164_LIKE_PATTERN, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber!: string;
}
