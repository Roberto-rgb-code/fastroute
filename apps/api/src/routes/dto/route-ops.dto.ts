import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DeliverStatus, IncidentReason } from '@prisma/client';

export class ChecklistEvidenceDto {
  @IsString()
  itemId!: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

/** RN-STA-02 / RN-CHK-04: km + gasolina inicial + evidencias del checklist. */
export class StartRouteDto {
  @IsNumber()
  @Min(0)
  kmInitial!: number;

  @IsNumber()
  @Min(0)
  gasInitial!: number;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistEvidenceDto)
  checklist?: ChecklistEvidenceDto[];
}

/** RN-EVT-03..07: evidencia de parada intermedia. */
export class SubmitEvidenceDto {
  @IsArray()
  @IsString({ each: true })
  images!: string[];

  @IsEnum(DeliverStatus)
  deliverStatus!: DeliverStatus;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsNumber()
  evLat?: number;

  @IsOptional()
  @IsNumber()
  evLng?: number;

  @IsOptional()
  @IsString()
  signatureUrl?: string;
}

/** RN-GAS-02 / RN-EVT-08: cierre del destino con km/gas final. */
export class CloseRouteDto {
  @IsNumber()
  @Min(0)
  kmFinal!: number;

  @IsNumber()
  @Min(0)
  gasFinal!: number;

  @IsOptional()
  @IsString()
  finalImg?: string;

  @IsOptional()
  @IsNumber()
  finalLat?: number;

  @IsOptional()
  @IsNumber()
  finalLng?: number;
}

export class DuplicateRouteDto {
  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  dateStart?: string;
}

export class CancelRouteDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

/** RN-GST-01/02. */
export class ExpenseDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  concept!: string;

  @IsString()
  @MinLength(1)
  paymentType!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsString()
  @MinLength(1)
  imageUrl!: string;
}

/** RN-INC-01: máximo 5 fotos. */
export class IncidentDto {
  @IsEnum(IncidentReason)
  reason!: IncidentReason;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
