import { AuthService } from '@/auth/auth.service';
import { Public } from '@/auth/public.decorator';
import { RateLimit } from '@/decorators/rate-limit.decorator';
import { useDto } from '@/decorators/use-dto.decorator';
import {
  AuthSessionResponseDto,
  WebAuthSessionResponseDto,
  WebLoginDto,
  WebRegisterDto,
  WebUserProfileDto,
  WebUserQueryDto,
} from '@/web/dto/user.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('web/users')
@ApiBearerAuth()
@Controller('/web/users')
export class WebUserController {
  constructor(private readonly authService: AuthService) {}

  @Get('profile')
  @ApiOperation({ summary: '按条件查看用户信息' })
  @ApiOkResponse({ type: WebUserProfileDto, description: '查询成功' })
  @useDto(WebUserProfileDto)
  public async getUserProfile(@Query() query: WebUserQueryDto): Promise<WebUserProfileDto> {
    return this.authService.getWebUserProfile(query);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Web 用户登录' })
  @ApiBody({ type: WebLoginDto })
  @ApiOkResponse({ type: WebAuthSessionResponseDto, description: '登录成功' })
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @useDto(WebAuthSessionResponseDto)
  public async login(@Body() loginDto: WebLoginDto): Promise<WebAuthSessionResponseDto> {
    const res = await this.authService.loginWebUser(loginDto);
    return { accessToken: res?.token };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Web 用户注册' })
  @ApiBody({ type: WebRegisterDto })
  @ApiOkResponse({ type: AuthSessionResponseDto, description: '注册成功' })
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @useDto(AuthSessionResponseDto)
  public async register(@Body() registerDto: WebRegisterDto): Promise<AuthSessionResponseDto> {
    return this.authService.registerWebUser(registerDto);
  }
}
