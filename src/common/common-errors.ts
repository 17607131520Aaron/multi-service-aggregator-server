import { HttpException, HttpStatus } from '@nestjs/common';

export const APP_ERROR_CODES = {
  VALIDATION_ERROR: { code: 1001, message: '参数无效' },
  MISSING_PARAMETER: { code: 1002, message: '缺少必填参数' },
  UNAUTHORIZED: { code: 1003, message: '未授权' },
  FORBIDDEN: { code: 1004, message: '权限不足' },
  NOT_FOUND: { code: 1005, message: '资源未找到' },
  CONFLICT: { code: 1006, message: '资源冲突' },
  TOO_MANY_REQUESTS: { code: 1007, message: '请求过于频繁' },
  UNPROCESSABLE_ENTITY: { code: 1008, message: '请求参数校验失败' },
  DATA_EXISTS: { code: 2001, message: '数据已存在' },
  DATA_NOT_FOUND: { code: 2002, message: '数据未找到' },
  BUSINESS_ERROR: { code: 3001, message: '业务逻辑错误' },
  OPERATION_TIMEOUT: { code: 3002, message: '操作超时' },
  INTERNAL_ERROR: { code: 9000, message: '内部服务器错误' },
  UNKNOWN_ERROR: { code: 9999, message: '未知错误' },
} as const;

type ErrorCodeValue = (typeof APP_ERROR_CODES)[keyof typeof APP_ERROR_CODES];

export class AppHttpException extends HttpException {
  constructor(
    public code: number,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
  public getCode(): number {
    return this.code;
  }
}

export function throwAppError(codeObj: ErrorCodeValue, status?: HttpStatus): never {
  throw new AppHttpException(codeObj.code, codeObj.message, status ?? HttpStatus.BAD_REQUEST);
}
