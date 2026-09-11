import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DeliverStatus, EventStatus } from '@prisma/client';

export class UpdateEventDto {
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsEnum(DeliverStatus)
  deliverStatus?: DeliverStatus;

  @IsOptional()
  @IsNumber()
  evLat?: number;

  @IsOptional()
  @IsNumber()
  evLng?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  signatureUrl?: string;
}
