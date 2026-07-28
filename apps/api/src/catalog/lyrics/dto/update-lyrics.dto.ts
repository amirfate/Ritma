import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateLyricsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsString()
  syncedContent?: string;
}
