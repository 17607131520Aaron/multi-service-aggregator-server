import type { ConfigService } from '@nestjs/config';

export interface AiStreamConfig {
  streamTimeoutMs: number;
}

export interface AiUploadConfig {
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
  storageDir: string;
  publicPathPrefix?: string;
}

const DEFAULT_ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export function getAiStreamConfig(configService: ConfigService): AiStreamConfig {
  return {
    streamTimeoutMs: Number(configService.get<number>('ai.streamTimeoutMs') ?? 60_000),
  };
}

export function getAiUploadConfig(configService: ConfigService): AiUploadConfig {
  const configuredMimeTypes = configService.get<string[]>('ai.upload.allowedMimeTypes');
  const publicPathPrefix = configService.get<string>('ai.upload.publicPathPrefix');

  return {
    maxFileSizeBytes: Number(
      configService.get<number>('ai.upload.maxFileSizeBytes') ?? 10 * 1024 * 1024,
    ),
    allowedMimeTypes:
      Array.isArray(configuredMimeTypes) && configuredMimeTypes.length > 0
        ? configuredMimeTypes
        : [...DEFAULT_ALLOWED_IMAGE_MIME_TYPES],
    storageDir: configService.get<string>('ai.upload.storageDir') ?? 'uploads/ai',
    ...(typeof publicPathPrefix === 'string' && publicPathPrefix.trim()
      ? { publicPathPrefix: publicPathPrefix.trim() }
      : {}),
  };
}
