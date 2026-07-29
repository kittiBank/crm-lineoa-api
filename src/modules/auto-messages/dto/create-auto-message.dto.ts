import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAutoMessageDto {
  @ApiProperty({ example: 'Promo menu reply' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: 'action=promo',
    description: 'Keyword matched against LINE postback data',
  })
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @ApiProperty({
    example: 'exact',
    enum: ['exact', 'contains'],
    required: false,
    default: 'exact',
  })
  @IsOptional()
  @IsString()
  @IsIn(['exact', 'contains'])
  matchType?: string;

  @ApiProperty({
    example: 'cltemplate123',
    description: 'Message template ID used for the reply',
  })
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @ApiProperty({
    example: 0,
    required: false,
    description: 'Lower value = higher priority when multiple rules match',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
