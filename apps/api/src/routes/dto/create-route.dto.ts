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

  /** RN-RTE-02: nacer de una plantilla. Si viene, stopIds puede omitirse. */
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stopIds?: string[];
}
