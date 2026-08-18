import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateArtistDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string;
}
