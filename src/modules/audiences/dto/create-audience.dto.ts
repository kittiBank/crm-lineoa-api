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
  'segment',
] as const;

export type AudienceSegmentType = (typeof AUDIENCE_SEGMENT_TYPES)[number];

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
    enum: AUDIENCE_SEGMENT_TYPES,
    example: 'user_type',
  })
  @IsString()
  @IsIn(AUDIENCE_SEGMENT_TYPES)
  type!: AudienceSegmentType;

  @ApiProperty({ type: AudienceCriteriaDto })
  @ValidateNested()
  @Type(() => AudienceCriteriaDto)
  criteria!: AudienceCriteriaDto;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
