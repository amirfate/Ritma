import { IsOptional, IsString, MaxLength } from 'class-validator';

import { PageQueryDto } from '../../pagination';

export class PublicAlbumQueryDto extends PageQueryDto {
  /** Case-insensitive substring match against the album's title. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  artistId?: string;
}
