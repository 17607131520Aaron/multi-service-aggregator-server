import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { AppUnauthorizedException } from '../common/enterprise-exceptions';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const authService = {
    verifyToken: jest.fn(),
  };

  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(reflector, authService as never);
  });

  it('allows public routes', async () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(true);
    const context = createContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.verifyToken).not.toHaveBeenCalled();
  });

  it('attaches user to request for valid bearer token', async () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(false);
    authService.verifyToken.mockResolvedValue({ userId: 'alice', username: 'alice' });
    const request = {
      headers: {
        authorization: 'Bearer signed-token',
      },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(authService.verifyToken).toHaveBeenCalledWith('signed-token');
    expect(request).toMatchObject({
      user: { userId: 'alice', username: 'alice' },
      token: 'signed-token',
    });
  });

  it('rejects malformed authorization header', async () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(false);

    await expect(
      guard.canActivate(
        createContext({
          headers: {
            authorization: 'invalid-token',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(AppUnauthorizedException);
  });
});

function createContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
