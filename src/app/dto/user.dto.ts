import { Exclude, Expose } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class AuthLoginDto {
  @ApiProperty({ description: '用户名', minLength: 3, maxLength: 20, example: 'alice' })
  @IsString()
  @IsNotEmpty({ message: '账号不能为空' })
  @MinLength(3, { message: '账号长度至少3个字符' })
  @MaxLength(20, { message: '账号长度不能超过20个字符' })
  public username: string;

  @ApiProperty({ description: '密码', minLength: 6, example: 'secret123' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码长度至少6个字符' })
  public password: string;
}

@Exclude()
export class AuthSessionResponseDto {
  @ApiProperty({ description: '用户名', example: 'alice' })
  @Expose()
  @IsString()
  public username: string;
}
