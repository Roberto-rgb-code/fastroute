import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class CreateDriverDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  licenseId?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  /** RN-DRV-03: vigencia de licencia e identificación. */
  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @IsOptional()
  @IsDateString()
  idDocExpiry?: string;

  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}
