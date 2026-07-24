import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCampaignDto {
  @ApiProperty({ example: 'Summer Sale Announcement', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Promotional broadcast for summer campaign', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'cltemplate123', required: false })
  @IsString()
  @IsOptional()
  templateId?: string;

  @ApiProperty({ example: 'all', enum: ['all', 'active', 'new'], required: false })
  @IsString()
  @IsIn(['all', 'active', 'new'])
  @IsOptional()
  audienceType?: string;

  @ApiProperty({
    example: 'draft',
    enum: ['draft', 'scheduled', 'processing', 'completed', 'failed'],
    required: false,
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: '2026-07-25T10:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  scheduledFor?: string;
}
