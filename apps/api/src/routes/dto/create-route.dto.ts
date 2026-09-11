import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRouteDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  dateStart?: string;

  @IsArray()
  @IsString({ each: true })
  stopIds!: string[];
}
