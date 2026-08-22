import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertLineAccountDto {
  @IsString()
  @IsIn(['test', 'save'])
  @ApiProperty({
    enum: ['test', 'save'],
    description: 'test = verify with LINE, save = verify and persist credentials',
  })
  action!: 'test' | 'save';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    description:
      'Required for first-time connect. Omit when testing an already saved account.',
  })
  channelAccessToken?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional()
  channelSecret?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  name?: string;
}

export class VerifyLineDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'LINE Bot Channel Access Token',
    example: 'YOUR_CHANNEL_ACCESS_TOKEN',
  })
  channelAccessToken!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'LINE Bot Channel Secret',
    example: 'YOUR_CHANNEL_SECRET',
  })
  channelSecret!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @ApiPropertyOptional()
  saveToDb?: boolean;

  @IsOptional()
  @IsString()
  botDisplayName?: string;
}
