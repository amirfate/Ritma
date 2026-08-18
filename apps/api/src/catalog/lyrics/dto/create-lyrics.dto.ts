import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLyricsDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  syncedContent?: string;
}
