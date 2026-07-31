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
  AUDIENCE_SEGMENT_TYPES,
  AudienceSegmentType,
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
    enum: AUDIENCE_SEGMENT_TYPES,
  })
  @IsOptional()
  @IsString()
  @IsIn(AUDIENCE_SEGMENT_TYPES)
  type?: AudienceSegmentType;

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
