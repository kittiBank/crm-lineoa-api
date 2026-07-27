import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class RequestOtpDto {
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
}
