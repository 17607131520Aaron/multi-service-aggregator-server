import { AuthService } from '@/auth/auth.service';
import { Public } from '@/auth/public.decorator';
import { AuthSessionResponseDto } from '@/app/dto/auth-response.dto';
import { RateLimit } from '@/decorators/rate-limit.decorator';
import { useDto } from '@/decorators/use-dto.decorator';
import { WebLoginDto, WebRegisterDto } from '@/web/dto/auth.dto';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('web/auth')
@Controller('/web/auth')
export class WebAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Web 用户登录' })
  @ApiBody({ type: WebLoginDto })
  @ApiOkResponse({ type: AuthSessionResponseDto, description: '登录成功' })
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @useDto(AuthSessionResponseDto)
  public async login(@Body() loginDto: WebLoginDto): Promise<AuthSessionResponseDto> {
    return this.authService.loginWebUser(loginDto);
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
