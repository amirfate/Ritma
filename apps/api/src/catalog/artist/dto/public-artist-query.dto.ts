import { IsOptional, IsString, MaxLength } from 'class-validator';

import { PageQueryDto } from '../../pagination';

export class PublicArtistQueryDto extends PageQueryDto {
  /** Case-insensitive substring match against the artist's name. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
