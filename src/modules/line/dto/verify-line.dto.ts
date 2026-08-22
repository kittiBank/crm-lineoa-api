import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: 'LINE OA Account Name',
    example: 'My LINE Bot',
    required: false,
  })
  name?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @ApiProperty({
    description: 'Save credentials to database',
    example: true,
    required: false,
  })
  saveToDb?: boolean;

  @IsString()
  @IsOptional()
  botDisplayName?: string;
}
