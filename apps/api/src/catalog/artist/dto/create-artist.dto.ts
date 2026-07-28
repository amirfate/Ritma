import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateArtistDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string;
}
