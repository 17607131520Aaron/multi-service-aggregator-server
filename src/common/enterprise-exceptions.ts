import { HttpStatus } from '@nestjs/common';
import { APP_ERROR_CODES, AppHttpException } from './common-errors';

export class AppValidationException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(
      APP_ERROR_CODES.VALIDATION_ERROR.code,
      message ?? APP_ERROR_CODES.VALIDATION_ERROR.message,
      status,
    );
  }
}

export class AppMissingParameterException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(
      APP_ERROR_CODES.MISSING_PARAMETER.code,
      message ?? APP_ERROR_CODES.MISSING_PARAMETER.message,
      status,
    );
  }
}

export class AppUnauthorizedException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.UNAUTHORIZED) {
    super(
      APP_ERROR_CODES.UNAUTHORIZED.code,
      message ?? APP_ERROR_CODES.UNAUTHORIZED.message,
      status,
    );
  }
}

export class AppForbiddenException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.FORBIDDEN) {
    super(APP_ERROR_CODES.FORBIDDEN.code, message ?? APP_ERROR_CODES.FORBIDDEN.message, status);
  }
}

export class AppNotFoundException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.NOT_FOUND) {
    super(APP_ERROR_CODES.NOT_FOUND.code, message ?? APP_ERROR_CODES.NOT_FOUND.message, status);
  }
}

export class AppConflictException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.CONFLICT) {
    super(APP_ERROR_CODES.CONFLICT.code, message ?? APP_ERROR_CODES.CONFLICT.message, status);
  }
}

export class AppTooManyRequestsException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.TOO_MANY_REQUESTS) {
    super(
      APP_ERROR_CODES.TOO_MANY_REQUESTS.code,
      message ?? APP_ERROR_CODES.TOO_MANY_REQUESTS.message,
      status,
    );
  }
}

export class AppUnprocessableEntityException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY) {
    super(
      APP_ERROR_CODES.UNPROCESSABLE_ENTITY.code,
      message ?? APP_ERROR_CODES.UNPROCESSABLE_ENTITY.message,
      status,
    );
  }
}

export class AppDataExistsException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.CONFLICT) {
    super(APP_ERROR_CODES.DATA_EXISTS.code, message ?? APP_ERROR_CODES.DATA_EXISTS.message, status);
  }
}

export class AppDataNotFoundException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.NOT_FOUND) {
    super(
      APP_ERROR_CODES.DATA_NOT_FOUND.code,
      message ?? APP_ERROR_CODES.DATA_NOT_FOUND.message,
      status,
    );
  }
}

export class AppBusinessException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(
      APP_ERROR_CODES.BUSINESS_ERROR.code,
      message ?? APP_ERROR_CODES.BUSINESS_ERROR.message,
      status,
    );
  }
}

export class AppOperationTimeoutException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.REQUEST_TIMEOUT) {
    super(
      APP_ERROR_CODES.OPERATION_TIMEOUT.code,
      message ?? APP_ERROR_CODES.OPERATION_TIMEOUT.message,
      status,
    );
  }
}

export class AppInternalErrorException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
    super(
      APP_ERROR_CODES.INTERNAL_ERROR.code,
      message ?? APP_ERROR_CODES.INTERNAL_ERROR.message,
      status,
    );
  }
}

export class AppUnknownErrorException extends AppHttpException {
  constructor(message?: string, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
    super(
      APP_ERROR_CODES.UNKNOWN_ERROR.code,
      message ?? APP_ERROR_CODES.UNKNOWN_ERROR.message,
      status,
    );
  }
}
