import { IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStopDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  @MinLength(2)
  address!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}
