import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCampaignDto {
  @ApiProperty({ example: 'Summer Campaign 2024', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'A promotional campaign for summer', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'active', required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: '2024-06-01T00:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2024-08-31T23:59:59Z', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
