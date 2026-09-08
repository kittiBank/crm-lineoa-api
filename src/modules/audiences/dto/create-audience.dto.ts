import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AudienceCriteriaDto } from './audience-criteria.dto';

export const AUDIENCE_SEGMENT_TYPES = [
  'all',
  'user_type',
  'active',
  'new',
  'combined',
  'segment',
] as const;

export type AudienceSegmentType = (typeof AUDIENCE_SEGMENT_TYPES)[number];

export const AUDIENCE_WRITABLE_TYPES = [
  'user_type',
  'active',
  'new',
  'combined',
] as const;

export type AudienceWritableType = (typeof AUDIENCE_WRITABLE_TYPES)[number];

export class CreateAudienceDto {
  @ApiProperty({ example: 'Active Members' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    required: false,
    example: 'Users active in the last 30 days',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: AUDIENCE_WRITABLE_TYPES,
    example: 'user_type',
    description:
      'Custom audience type. All LINE users is a broadcast option, not a saved audience.',
  })
  @IsString()
  @IsIn(AUDIENCE_WRITABLE_TYPES)
  type!: AudienceWritableType;

  @ApiProperty({ type: AudienceCriteriaDto })
  @ValidateNested()
  @Type(() => AudienceCriteriaDto)
  criteria!: AudienceCriteriaDto;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
