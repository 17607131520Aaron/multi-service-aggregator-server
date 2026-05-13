import type { ArgumentsHost } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { HttpExceptionFilter } from '@/interceptors/http-exception.interceptor';

describe('HttpExceptionFilter', () => {
  const buildHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status, json };
    const request = {
      method: 'POST',
      url: '/web/auth/register',
      requestId: 'req-1',
    };

    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;

    return { host, response };
  };

  it('maps missing table database errors to a clear 500 response', () => {
    const filter = new HttpExceptionFilter(9000);
    const { host, response } = buildHost();
    const exception = new QueryFailedError('SELECT 1', [], {
      code: 'ER_NO_SUCH_TABLE',
      errno: 1146,
      sqlMessage: "Table 'multi-test.users' doesn't exist",
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 9000,
        data: null,
        message: '数据库表不存在，请先执行迁移',
        path: '/web/auth/register',
        requestId: 'req-1',
      }),
    );
  });

  it('maps duplicate entry database errors to a conflict response', () => {
    const filter = new HttpExceptionFilter(9000);
    const { host, response } = buildHost();
    const exception = new QueryFailedError('INSERT INTO users ...', [], {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
      sqlMessage: "Duplicate entry 'admin' for key 'uk_users_username'",
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 2001,
        data: null,
        message: '数据已存在',
      }),
    );
  });
});
