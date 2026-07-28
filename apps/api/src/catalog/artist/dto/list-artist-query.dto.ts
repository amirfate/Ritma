import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

import { TransformBooleanQueryParam } from '../../dto/parse-boolean-query.transform';
import { PageQueryDto } from '../../pagination';

export class ListArtistQueryDto extends PageQueryDto {
  /** Case-insensitive substring match against the artist's name. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @TransformBooleanQueryParam()
  @IsBoolean()
  isActive?: boolean;
}
