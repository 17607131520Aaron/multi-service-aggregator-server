import { RateLimit } from '@/decorators/rate-limit.decorator';
import { useDto } from '@/decorators/use-dto.decorator';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthLoginDto, AuthSessionResponseDto } from './dto/user.dto';

@ApiTags('app/user')
@Controller('/app/user')
export class AuthController {
  @Post('login')
  @ApiOperation({ summary: '用户登录' })
  @ApiBody({ type: AuthLoginDto })
  @ApiOkResponse({ type: AuthSessionResponseDto, description: '登录成功' })
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @useDto(AuthSessionResponseDto)
  public async login(@Body() loginDto: AuthLoginDto): Promise<AuthSessionResponseDto> {
    return { username: loginDto.username };
  }
}
