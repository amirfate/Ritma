import { Genre } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { PageQueryDto } from '../../pagination';

export class PublicTrackQueryDto extends PageQueryDto {
  /** Case-insensitive substring match against the track's title. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  artistId?: string;

  @IsOptional()
  @IsString()
  albumId?: string;

  @IsOptional()
  @IsEnum(Genre)
  genre?: Genre;
}
