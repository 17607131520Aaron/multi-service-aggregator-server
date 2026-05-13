import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { IsString } from 'class-validator';

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

@Exclude()
export class UserProfileDto {
  @ApiProperty({ description: '用户 ID', example: '1' })
  @Expose()
  @IsString()
  public userId: string;

  @ApiProperty({ description: '用户名', example: 'alice', nullable: true })
  @Expose()
  public username: string | null;

  @ApiProperty({ description: '邮箱', example: 'alice@example.com', nullable: true })
  @Expose()
  public email: string | null;

  @ApiProperty({ description: '手机号', example: '13800138000', nullable: true })
  @Expose()
  public phone: string | null;
}
