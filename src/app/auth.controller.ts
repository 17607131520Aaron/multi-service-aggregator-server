import { AuthSessionResponseDto, UserProfileDto } from '@/app/dto/auth-response.dto';
import {
  AppLoginDto,
  AppRegisterDto,
  SendVerificationCodeDto,
  SendVerificationCodeResponseDto,
} from '@/app/dto/auth.dto';
import { AuthenticatedUser, AuthService } from '@/auth/auth.service';
import { Public } from '@/auth/public.decorator';
import { RateLimit } from '@/decorators/rate-limit.decorator';
import { useDto } from '@/decorators/use-dto.decorator';
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@ApiTags('app/auth')
@Controller('/app/auth')
export class AppAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'App 用户注册' })
  @ApiBody({ type: AppRegisterDto })
  @ApiOkResponse({ type: AuthSessionResponseDto, description: '注册成功' })
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @useDto(AuthSessionResponseDto)
  public async register(@Body() registerDto: AppRegisterDto): Promise<AuthSessionResponseDto> {
    return this.authService.registerAppUser(registerDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'App 用户登录' })
  @ApiBody({ type: AppLoginDto })
  @ApiOkResponse({ type: AuthSessionResponseDto, description: '登录成功' })
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @useDto(AuthSessionResponseDto)
  public async login(@Body() loginDto: AppLoginDto): Promise<AuthSessionResponseDto> {
    return this.authService.loginAppUser(loginDto);
  }

  @Public()
  @Post('verification-code')
  @ApiOperation({ summary: '发送手机验证码' })
  @ApiBody({ type: SendVerificationCodeDto })
  @ApiOkResponse({ type: SendVerificationCodeResponseDto, description: '发送成功' })
  public async sendVerificationCode(
    @Body() dto: SendVerificationCodeDto,
  ): Promise<SendVerificationCodeResponseDto> {
    return this.authService.sendPhoneVerificationCode(dto.phone);
  }

  @Get('profile')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserProfileDto, description: '获取成功' })
  @useDto(UserProfileDto)
  public getProfile(@Req() request: AuthenticatedRequest): UserProfileDto {
    return request.user;
  }
}
