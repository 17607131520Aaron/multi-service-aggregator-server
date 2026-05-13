import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum AppRegisterType {
  ACCOUNT = 'account',
  PHONE = 'phone',
}

export enum AppLoginType {
  ACCOUNT_PASSWORD = 'account_password',
  PHONE_PASSWORD = 'phone_password',
  PHONE_CODE = 'phone_code',
}

export class AppRegisterDto {
  @ApiProperty({
    description: '注册方式',
    enum: AppRegisterType,
    example: AppRegisterType.ACCOUNT,
  })
  @IsEnum(AppRegisterType)
  public type: AppRegisterType;

  @ApiProperty({ description: '用户名，账号注册时必填', required: false, example: 'alice' })
  @ValidateIf((dto: AppRegisterDto) => dto.type === AppRegisterType.ACCOUNT)
  @IsString()
  @IsNotEmpty({ message: '账号不能为空' })
  @MinLength(3, { message: '账号长度至少3个字符' })
  @MaxLength(20, { message: '账号长度不能超过20个字符' })
  public username?: string;

  @ApiProperty({ description: '手机号，手机号注册时必填', required: false, example: '13800138000' })
  @ValidateIf((dto: AppRegisterDto) => dto.type === AppRegisterType.PHONE)
  @IsMobilePhone('zh-CN', {}, { message: '手机号格式不正确' })
  public phone?: string;

  @ApiProperty({ description: '密码', example: 'secret123' })
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

export class AppLoginDto {
  @ApiProperty({
    description: '登录方式',
    enum: AppLoginType,
    example: AppLoginType.ACCOUNT_PASSWORD,
  })
  @IsEnum(AppLoginType)
  public type: AppLoginType;

  @ApiProperty({ description: '用户名，账号密码登录时必填', required: false, example: 'alice' })
  @ValidateIf((dto: AppLoginDto) => dto.type === AppLoginType.ACCOUNT_PASSWORD)
  @IsString()
  @IsNotEmpty({ message: '账号不能为空' })
  public username?: string;

  @ApiProperty({ description: '手机号，手机号登录时必填', required: false, example: '13800138000' })
  @ValidateIf(
    (dto: AppLoginDto) =>
      dto.type === AppLoginType.PHONE_PASSWORD || dto.type === AppLoginType.PHONE_CODE,
  )
  @IsMobilePhone('zh-CN', {}, { message: '手机号格式不正确' })
  public phone?: string;

  @ApiProperty({ description: '密码，密码登录时必填', required: false, example: 'secret123' })
  @ValidateIf(
    (dto: AppLoginDto) =>
      dto.type === AppLoginType.ACCOUNT_PASSWORD || dto.type === AppLoginType.PHONE_PASSWORD,
  )
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  public password?: string;

  @ApiProperty({ description: '手机验证码，验证码登录时必填', required: false, example: '123456' })
  @ValidateIf((dto: AppLoginDto) => dto.type === AppLoginType.PHONE_CODE)
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码必须为6位数字' })
  public verificationCode?: string;
}

export class SendVerificationCodeDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsMobilePhone('zh-CN', {}, { message: '手机号格式不正确' })
  public phone: string;
}

export class SendVerificationCodeResponseDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  public phone: string;

  @ApiProperty({ description: '验证码有效期，单位秒', example: 300 })
  public expiresIn: number;

  @ApiProperty({ description: '验证码（开发环境便于联调）', example: '123456', required: false })
  @IsOptional()
  public verificationCode?: string;
}
