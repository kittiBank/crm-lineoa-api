import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    description: 'LINE user ID from LIFF profile',
  })
  @IsString()
  @IsNotEmpty()
  lineUserId!: string;

  @ApiProperty({
    example: '0812345678',
    description: 'Thai mobile phone number',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[0-9+\-\s]{9,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone!: string;

  @ApiProperty({
    example: '123456',
    description: 'OTP code',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit code' })
  otp!: string;
}
