import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { LineUserTier } from '@/modules/line/types/line-user-tier';
import {
  AUDIENCE_USER_TYPES,
  AudienceUserTier,
  AudienceUserType,
} from './audience-criteria.dto';
import {
  AUDIENCE_SEGMENT_TYPES,
  AudienceSegmentType,
} from './create-audience.dto';

export class EstimateAudienceDto {
  @ApiProperty({
    enum: AUDIENCE_SEGMENT_TYPES,
    example: 'all',
    description:
      'Audience type to estimate. LINE Insight is used only when type = all.',
  })
  @IsString()
  @IsIn(AUDIENCE_SEGMENT_TYPES)
  type!: AudienceSegmentType;

  @ApiPropertyOptional({
    isArray: true,
    enum: AUDIENCE_USER_TYPES,
    example: ['Member', 'Guest'],
  })
  @IsOptional()
  @Transform(({ value }) =>
    value == null || Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @ArrayUnique()
  @IsIn(AUDIENCE_USER_TYPES, { each: true })
  userTypes?: AudienceUserType[];

  @ApiPropertyOptional({
    isArray: true,
    enum: LineUserTier,
    example: [LineUserTier.Silver, LineUserTier.Gold],
  })
  @IsOptional()
  @Transform(({ value }) =>
    value == null || Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @ArrayUnique()
  @IsEnum(LineUserTier, { each: true })
  userTiers?: AudienceUserTier[];

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  activityDays?: number;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  newFollowerDays?: number;
}
