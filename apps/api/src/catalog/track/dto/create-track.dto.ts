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
  ValidateIf,
} from 'class-validator';

export class CreateTrackDto {
  @IsString()
  @IsNotEmpty()
  artistId!: string;

  @IsOptional()
  @IsString()
  albumId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsEnum(Genre)
  genre!: Genre;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60 * 60)
  durationSeconds!: number;

  @IsEnum(TrackType)
  type!: TrackType;

  /** Required when `type` is PAID; must be omitted when FREE. */
  @ValidateIf((dto: CreateTrackDto) => dto.type === TrackType.PAID)
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsUrl({ require_tld: false })
  flacFileUrl!: string;

  @IsUrl({ require_tld: false })
  coverImageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  credits?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  story?: string;
}
