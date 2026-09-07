import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RichMenuBoundsDto {
  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  x!: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  y!: number;

  @ApiProperty({ example: 833 })
  @IsInt()
  @Min(1)
  width!: number;

  @ApiProperty({ example: 843 })
  @IsInt()
  @Min(1)
  height!: number;
}

export class RichMenuAreaDto {
  @ApiProperty({ example: 'Register' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({
    enum: ['postback', 'message', 'uri', 'datetimepicker'],
    example: 'postback',
  })
  @IsIn(['postback', 'message', 'uri', 'datetimepicker'])
  actionType!: 'postback' | 'message' | 'uri' | 'datetimepicker';

  @ApiProperty({ required: false, example: 'action=register' })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiProperty({ required: false, example: 'สมัครสมาชิก' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({ required: false, example: 'https://example.com' })
  @IsOptional()
  @IsString()
  uri?: string;

  @ApiProperty({
    required: false,
    enum: ['date', 'time', 'datetime'],
    example: 'datetime',
  })
  @IsOptional()
  @IsIn(['date', 'time', 'datetime'])
  mode?: 'date' | 'time' | 'datetime';

  @ApiProperty({
    required: false,
    type: RichMenuBoundsDto,
    description: 'Required for big/compact/custom layouts; optional for legacy grids',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RichMenuBoundsDto)
  bounds?: RichMenuBoundsDto;
}

export class CreateRichMenuDto {
  @ApiProperty({ example: 'Default Guest Menu' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string;

  @ApiProperty({ enum: ['default', 'member'], example: 'default' })
  @IsIn(['default', 'member'])
  menuType!: 'default' | 'member';

  @ApiProperty({ example: 'Menu' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(14)
  chatBarText!: string;

  @ApiProperty({ example: 'big', description: 'big | compact | custom (or legacy layout id)' })
  @IsString()
  @IsNotEmpty()
  layoutId!: string;

  @ApiProperty({ type: [RichMenuAreaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichMenuAreaDto)
  areas!: RichMenuAreaDto[];
}
