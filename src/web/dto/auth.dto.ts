import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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
