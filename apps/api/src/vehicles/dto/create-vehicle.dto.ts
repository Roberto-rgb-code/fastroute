import { IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { VehicleStatus } from '@prisma/client';

export class CreateVehicleDto {
  @IsString()
  @MinLength(2)
  plate!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  capacity?: number;

  @IsOptional()
  @IsString()
  insurance?: string;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;
}
