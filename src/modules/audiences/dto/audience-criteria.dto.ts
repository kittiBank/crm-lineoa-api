import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import {
  LineUserTier,
} from '@/modules/line/types/line-user-tier';

export const AUDIENCE_USER_TYPES = ['Member', 'Guest'] as const;
export type AudienceUserType = (typeof AUDIENCE_USER_TYPES)[number];

export type AudienceUserTier = LineUserTier;

export class AudienceCriteriaDto {
  @ApiProperty({
    required: false,
    isArray: true,
    enum: AUDIENCE_USER_TYPES,
    example: ['Member', 'Guest'],
    description: 'Used when type = user_type.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(AUDIENCE_USER_TYPES, { each: true })
  userTypes?: AudienceUserType[];

  @ApiProperty({
    required: false,
    isArray: true,
    enum: LineUserTier,
    example: [LineUserTier.Silver, LineUserTier.Gold],
    description:
      'Optional user tiers when type = user_type. Leave empty to include all tiers.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(LineUserTier, { each: true })
  userTiers?: AudienceUserTier[];

  @ApiProperty({
    required: false,
    example: 30,
    description: 'Days of recent activity when type = active',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  activityDays?: number;

  @ApiProperty({
    required: false,
    example: 14,
    description: 'Days since follow when type = new',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  newFollowerDays?: number;
}
