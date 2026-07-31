import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export const AUDIENCE_USER_TYPES = ['Member', 'Guest', 'VIP'] as const;
export type AudienceUserType = (typeof AUDIENCE_USER_TYPES)[number];

export class AudienceCriteriaDto {
  @ApiProperty({
    required: false,
    isArray: true,
    enum: AUDIENCE_USER_TYPES,
    example: ['Member', 'Guest'],
    description: 'Used when type = user_type. VIP is not supported yet.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(AUDIENCE_USER_TYPES, { each: true })
  userTypes?: AudienceUserType[];

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
