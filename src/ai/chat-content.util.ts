const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const GIF87_SIGNATURE = Buffer.from('GIF87a');
const GIF89_SIGNATURE = Buffer.from('GIF89a');
const RIFF_SIGNATURE = Buffer.from('RIFF');
const WEBP_SIGNATURE = Buffer.from('WEBP');

export function detectImageMimeType(buffer: Buffer): string | null {
  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (buffer.length >= JPEG_SIGNATURE.length && buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= GIF87_SIGNATURE.length &&
    (buffer.subarray(0, GIF87_SIGNATURE.length).equals(GIF87_SIGNATURE) ||
      buffer.subarray(0, GIF89_SIGNATURE.length).equals(GIF89_SIGNATURE))
  ) {
    return 'image/gif';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, RIFF_SIGNATURE.length).equals(RIFF_SIGNATURE) &&
    buffer.subarray(8, 12).equals(WEBP_SIGNATURE)
  ) {
    return 'image/webp';
  }

  return null;
}

const MIME_TYPE_EXTENSION_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function mimeTypeToExtension(mimeType: string): string | null {
  return MIME_TYPE_EXTENSION_MAP[mimeType] ?? null;
}

export function resolveUploadedImageMimeType(
  buffer: Buffer,
  declaredMimeType?: string,
): string | null {
  const detectedMimeType = detectImageMimeType(buffer);

  if (detectedMimeType) {
    return detectedMimeType;
  }

  if (!declaredMimeType) {
    return null;
  }

  const normalizedMimeType = declaredMimeType.trim().toLowerCase();

  if (normalizedMimeType.startsWith('image/')) {
    return normalizedMimeType;
  }

  return null;
}

const STORED_AI_FILE_PATH_PATTERN = /\/web\/ai\/files\/([^/?#]+)$/i;

export function normalizeImageUrlInput(imageUrl: unknown): { url: string } | null {
  if (typeof imageUrl === 'string') {
    const url = imageUrl.trim();

    return url ? { url } : null;
  }

  if (typeof imageUrl === 'object' && imageUrl !== null && 'url' in imageUrl) {
    const url = (imageUrl as { url?: unknown }).url;

    if (typeof url === 'string') {
      const trimmedUrl = url.trim();

      return trimmedUrl ? { url: trimmedUrl } : null;
    }
  }

  return null;
}

export function parseStoredAiFileNameFromUrl(url: string): string | null {
  const match = url.match(STORED_AI_FILE_PATH_PATTERN);

  return match?.[1] ?? null;
}

export function buildDataImageUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export function isBlobImageUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith('blob:');
}

export function isDataImageUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith('data:');
}
