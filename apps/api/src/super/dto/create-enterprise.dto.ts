import { IsObject, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateEnterpriseDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug: solo minúsculas, números y guiones',
  })
  slug!: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
