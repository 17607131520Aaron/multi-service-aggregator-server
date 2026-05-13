import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { HealthService } from '@/health/health.service';

@ApiTags('system/health')
@Controller('/system/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: '存活检查' })
  public getLiveness(@Res() response: Response): void {
    response.status(HttpStatus.OK).json(this.healthService.getLiveness());
  }

  @Get('ready')
  @ApiOperation({ summary: '就绪检查' })
  public async getReadiness(@Res() response: Response): Promise<void> {
    const result = await this.healthService.getReadiness();
    const statusCode = result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    response.status(statusCode).json(result);
  }
}
