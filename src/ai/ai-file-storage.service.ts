import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { mimeTypeToExtension } from '@/ai/chat-content.util';
import { getAiUploadConfig } from '@/config/ai.config';

const STORED_FILE_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|webp|gif)$/i;

@Injectable()
export class AiFileStorageService {
  constructor(private readonly configService: ConfigService) {}

  public async saveImage(buffer: Buffer, mimeType: string): Promise<string> {
    const extension = mimeTypeToExtension(mimeType);

    if (!extension) {
      throw new Error(`unsupported mime type: ${mimeType}`);
    }

    const storedName = `${randomUUID()}${extension}`;
    const storageDir = this.resolveStorageDir();

    await mkdir(storageDir, { recursive: true });
    await writeFile(join(storageDir, storedName), buffer);

    return storedName;
  }

  public async readImage(storedName: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (!STORED_FILE_NAME_PATTERN.test(storedName)) {
      throw new Error('invalid stored file name');
    }

    const buffer = await readFile(join(this.resolveStorageDir(), storedName));
    const mimeType = this.inferMimeTypeFromName(storedName);

    return { buffer, mimeType };
  }

  public buildPublicFileUrl(origin: string, pathPrefix: string, storedName: string): string {
    const normalizedOrigin = origin.replace(/\/$/, '');
    const normalizedPrefix = this.normalizePathPrefix(pathPrefix);
    const filePath = `${normalizedPrefix}/web/ai/files/${storedName}`;

    return `${normalizedOrigin}${filePath}`;
  }

  public resolvePublicPathPrefix(): string {
    const uploadConfig = getAiUploadConfig(this.configService);
    const apiPrefix = this.configService.get<string>('app.apiPrefix') ?? '';

    return uploadConfig.publicPathPrefix ?? apiPrefix;
  }

  private resolveStorageDir(): string {
    const { storageDir } = getAiUploadConfig(this.configService);

    return join(process.cwd(), storageDir);
  }

  private normalizePathPrefix(pathPrefix: string): string {
    const trimmed = pathPrefix.trim();

    if (!trimmed) {
      return '';
    }

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  private inferMimeTypeFromName(storedName: string): string {
    const extension = storedName.slice(storedName.lastIndexOf('.')).toLowerCase();

    switch (extension) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.gif':
        return 'image/gif';
      default:
        return 'application/octet-stream';
    }
  }
}
