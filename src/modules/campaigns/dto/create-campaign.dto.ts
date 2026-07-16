import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({
    example: 'Summer Campaign 2024',
    description: 'Campaign name',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: 'A promotional campaign for summer products',
    description: 'Campaign description (optional)',
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'active',
    description: 'Campaign status (optional)',
    enum: ['draft', 'scheduled', 'processing', 'completed', 'failed'],
    required: false,
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({
    example: '2024-06-01T00:00:00Z',
    description: 'Campaign start date (ISO 8601 format, optional)',
    type: String,
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    example: '2024-08-31T23:59:59Z',
    description: 'Campaign end date (ISO 8601 format, optional)',
    type: String,
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
