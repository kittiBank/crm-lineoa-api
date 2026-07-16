import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ example: 'clxxx123', description: 'LINE Account ID' })
  @IsString()
  @IsNotEmpty()
  lineAccountId!: string;

  @ApiProperty({ example: 'U1234567890abcdef1234567890abcdef', description: 'LINE User ID' })
  @IsString()
  @IsNotEmpty()
  lineUserId!: string;

  @ApiProperty({ example: 'Hello, this is a test message', description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty({ example: 'text', required: false })
  @IsString()
  @IsOptional()
  type?: string;
}
