import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ValidateInvitationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  code!: string;
}
