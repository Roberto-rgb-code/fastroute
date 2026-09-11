import { IsNumber, IsOptional, IsString } from 'class-validator';

export class PublishLocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsString()
  routeId?: string;

  @IsOptional()
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsNumber()
  speedKmh?: number;
}
