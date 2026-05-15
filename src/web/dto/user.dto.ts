import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  @ApiProperty({
    description: '头像地址',
    example: 'https://example.com/avatar.png',
    nullable: true,
  })
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

export class WebLoginDto {
  @ApiProperty({ description: '用户名', example: 'admin' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @MinLength(3, { message: '用户名长度至少3个字符' })
  @MaxLength(20, { message: '用户名长度不能超过20个字符' })
  public username: string;

  @ApiProperty({ description: '密码', example: 'secret123' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度至少6个字符' })
  @MaxLength(32, { message: '密码长度不能超过32个字符' })
  public password: string;

  @ApiProperty({ description: '是否记住我', example: true, required: false })
  @IsOptional()
  @IsBoolean()
  public rememberMe?: boolean;
}

//登录接口响应
export class WebAuthSessionResponseDto {
  @ApiProperty({ description: 'token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' })
  @Expose()
  @IsString()
  public accessToken: string;
}

export class WebRegisterDto {
  @ApiProperty({ description: '用户名', example: 'alice' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @MinLength(3, { message: '用户名长度至少3个字符' })
  @MaxLength(20, { message: '用户名长度不能超过20个字符' })
  public username: string;

  @ApiProperty({ description: '邮箱地址', example: 'alice@example.com' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  public email: string;

  @ApiProperty({ description: '设置密码', example: 'secret123' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度至少6个字符' })
  @MaxLength(32, { message: '密码长度不能超过32个字符' })
  public password: string;

  @ApiProperty({ description: '确认密码', example: 'secret123' })
  @IsString()
  @IsNotEmpty({ message: '确认密码不能为空' })
  public confirmPassword: string;
}

//注册响应
@Exclude()
export class AuthSessionResponseDto {
  @ApiProperty({ description: '用户 ID', example: '1' })
  @Expose()
  @IsString()
  public userId: string;

  @ApiProperty({ description: '用户名', example: 'alice' })
  @Expose()
  @IsString()
  public username: string;

  @ApiProperty({ description: '手机号', example: '13800138000', nullable: true })
  @Expose()
  public phone: string | null;

  @ApiProperty({ description: '访问令牌', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @Expose()
  @IsString()
  public token: string;

  @ApiProperty({ description: 'token 有效期，单位秒', example: 3600 })
  @Expose()
  public expiresIn: number;
}
