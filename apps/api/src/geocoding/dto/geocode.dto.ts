import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class GeocodeQueryDto {
  @IsString()
  @MinLength(3)
  query!: string;

  /** Código ISO-3166 alpha-2; por defecto mx. */
  @IsOptional()
  @IsString()
  country?: string;
}

export class ReverseGeocodeDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}
