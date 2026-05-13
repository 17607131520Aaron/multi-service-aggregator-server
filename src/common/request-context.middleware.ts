import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export interface RequestWithContext extends Request {
  requestId?: string;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  public use(request: RequestWithContext, response: Response, next: NextFunction): void {
    const incomingRequestId = request.headers['x-request-id'];
    const normalizedRequestId =
      typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
        ? incomingRequestId.trim().slice(0, 100)
        : randomUUID();

    request.requestId = normalizedRequestId;
    response.setHeader('x-request-id', normalizedRequestId);

    next();
  }
}
