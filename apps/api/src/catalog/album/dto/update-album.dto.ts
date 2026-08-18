import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateAlbumDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  coverImageUrl?: string;

  @IsOptional()
  @IsDateString()
  releasedAt?: string;
}
