import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

@Exclude()
export class WebUserQueryDto {
  @ApiPropertyOptional({ description: '用户 ID', example: '1' })
  @Expose()
  @IsOptional()
  @IsString()
  public userId?: string;

  @ApiPropertyOptional({ description: '用户名', example: 'alice' })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '用户名长度不能超过20个字符' })
  public username?: string;

  @ApiPropertyOptional({ description: '邮箱地址', example: 'alice@example.com' })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(128, { message: '邮箱长度不能超过128个字符' })
  public email?: string;

  @ApiPropertyOptional({ description: '手机号', example: '13800138000' })
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '手机号长度不能超过20个字符' })
  public phone?: string;
}

@Exclude()
export class WebUserProfileDto {
  @ApiProperty({ description: '用户 ID', example: '1' })
  @Expose()
  public userId: string;

  @ApiProperty({ description: '用户名', example: 'alice', nullable: true })
  @Expose()
  public username: string | null;

  @ApiProperty({ description: '昵称', example: 'Alice', nullable: true })
  @Expose()
  public nickname: string | null;

  @ApiProperty({ description: '头像地址', example: 'https://example.com/avatar.png', nullable: true })
  @Expose()
  public avatarUrl: string | null;

  @ApiProperty({ description: '邮箱', example: 'alice@example.com', nullable: true })
  @Expose()
  public email: string | null;

  @ApiProperty({ description: '手机号', example: '13800138000', nullable: true })
  @Expose()
  public phone: string | null;

  @ApiProperty({ description: '注册来源', example: 'web' })
  @Expose()
  public registrationSource: string;

  @ApiProperty({ description: '是否启用', example: true })
  @Expose()
  public enabled: boolean;

  @ApiProperty({ description: '创建时间', example: '2026-05-14T10:00:00.000Z' })
  @Expose()
  public createdAt: Date;

  @ApiProperty({ description: '更新时间', example: '2026-05-14T10:30:00.000Z' })
  @Expose()
  public updatedAt: Date;
}
