import { IsBoolean, IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from 'class-validator';
import { StopType } from '@prisma/client';

export class CreateStopDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsString()
  @MinLength(2)
  address!: string;

  /** Opcional: si falta, se geocodifica con geopy/Nominatim (gratis). */
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  /** visit | gas | parking | cedis | main | workshop (RN-STP). */
  @IsOptional()
  @IsEnum(StopType)
  type?: StopType;

  @IsOptional()
  @IsBoolean()
  isMain?: boolean;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  /** RN-STP-05: teléfono para avisar al cliente de esa parada. */
  @IsOptional()
  @IsString()
  phoneNotification?: string;

  @IsOptional()
  @IsString()
  schedule?: string;

  @IsOptional()
  @IsString()
  commentInternal?: string;

  @IsOptional()
  @IsString()
  commentDriver?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  tagColor?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}
