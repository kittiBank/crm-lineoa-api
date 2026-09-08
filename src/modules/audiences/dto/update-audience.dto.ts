import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AudienceCriteriaDto } from './audience-criteria.dto';
import {
  AUDIENCE_WRITABLE_TYPES,
  AudienceWritableType,
} from './create-audience.dto';

export class UpdateAudienceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  description?: string | null;

  @ApiProperty({
    required: false,
    enum: AUDIENCE_WRITABLE_TYPES,
    description:
      'Custom audience type. All LINE users is a broadcast option, not a saved audience.',
  })
  @IsOptional()
  @IsString()
  @IsIn(AUDIENCE_WRITABLE_TYPES)
  type?: AudienceWritableType;

  @ApiProperty({ required: false, type: AudienceCriteriaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceCriteriaDto)
  criteria?: AudienceCriteriaDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
