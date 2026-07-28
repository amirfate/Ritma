import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

import { TransformBooleanQueryParam } from '../../dto/parse-boolean-query.transform';
import { PageQueryDto } from '../../pagination';

export class ListAlbumQueryDto extends PageQueryDto {
  /** Case-insensitive substring match against the album's title. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  artistId?: string;

  @IsOptional()
  @TransformBooleanQueryParam()
  @IsBoolean()
  isPublished?: boolean;
}
