import { IsString } from 'class-validator';

export class AddRouteStopDto {
  @IsString()
  stopId!: string;
}
