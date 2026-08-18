import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateAlbumDto {
  @IsString()
  @IsNotEmpty()
  artistId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsUrl({ require_tld: false })
  coverImageUrl!: string;

  @IsOptional()
  @IsDateString()
  releasedAt?: string;
}
