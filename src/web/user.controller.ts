import { AuthService } from '@/auth/auth.service';
import { useDto } from '@/decorators/use-dto.decorator';
import { WebUserProfileDto, WebUserQueryDto } from '@/web/dto/user.dto';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

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
}
