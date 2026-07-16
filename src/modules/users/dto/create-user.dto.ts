import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address (must be unique)',
    type: String,
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'password123',
    description: 'User password (minimum 6 characters)',
    type: String,
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'User full name (optional)',
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;
}
