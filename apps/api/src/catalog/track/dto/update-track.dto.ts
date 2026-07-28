import { Genre, TrackType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTrackDto {
  /** `null` clears the album association; omit to leave it unchanged. */
  @IsOptional()
  @IsString()
  albumId?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(Genre)
  genre?: Genre;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60 * 60)
  durationSeconds?: number;

  @IsOptional()
  @IsEnum(TrackType)
  type?: TrackType;

  /** Cross-checked against the (possibly updated) `type` in the service, not here. */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  flacFileUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  credits?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  story?: string;
}
