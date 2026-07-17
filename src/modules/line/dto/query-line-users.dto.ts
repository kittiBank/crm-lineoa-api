import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryLineUsersDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['all', 'displayName', 'userId'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'displayName', 'userId'])
  searchType?: 'all' | 'displayName' | 'userId' = 'all';

  @ApiPropertyOptional({
    enum: ['All', 'Active', 'Blocked', 'Unfollowed'],
    default: 'All',
  })
  @IsOptional()
  @IsIn(['All', 'Active', 'Blocked', 'Unfollowed'])
  status?: 'All' | 'Active' | 'Blocked' | 'Unfollowed' = 'All';

  @ApiPropertyOptional({
    enum: ['All', 'Member', 'Guest'],
    default: 'All',
  })
  @IsOptional()
  @IsIn(['All', 'Member', 'Guest'])
  userType?: 'All' | 'Member' | 'Guest' = 'All';

  @ApiPropertyOptional({ description: 'Filter by date added (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateRange?: string;
}
