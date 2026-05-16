import {
  buildDataImageUrl,
  detectImageMimeType,
  isBlobImageUrl,
  mimeTypeToExtension,
  normalizeImageUrlInput,
  parseStoredAiFileNameFromUrl,
  resolveUploadedImageMimeType,
} from '@/ai/chat-content.util';

describe('chat-content.util', () => {
  it('detects png signature', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

    expect(detectImageMimeType(buffer)).toBe('image/png');
  });

  it('maps mime type to extension', () => {
    expect(mimeTypeToExtension('image/png')).toBe('.png');
    expect(mimeTypeToExtension('image/jpeg')).toBe('.jpg');
  });

  it('prefers detected mime type over declared mime type', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

    expect(resolveUploadedImageMimeType(buffer, 'image/jpeg')).toBe('image/png');
  });

  it('normalizes string image_url shorthand', () => {
    expect(normalizeImageUrlInput('https://example.com/a.png')).toEqual({
      url: 'https://example.com/a.png',
    });
  });

  it('normalizes object image_url payload', () => {
    expect(normalizeImageUrlInput({ url: 'https://example.com/a.png' })).toEqual({
      url: 'https://example.com/a.png',
    });
  });

  it('parses stored ai file name from public url', () => {
    expect(
      parseStoredAiFileNameFromUrl(
        'http://localhost:3000/api/web/ai/files/6ba7b810-9dad-11d1-80b4-00c04fd430c8.png',
      ),
    ).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8.png');
  });

  it('builds data image url', () => {
    const buffer = Buffer.from('abc');

    expect(buildDataImageUrl(buffer, 'image/png')).toBe('data:image/png;base64,YWJj');
  });

  it('detects blob image urls', () => {
    expect(isBlobImageUrl('blob:http://localhost:3000/uuid')).toBe(true);
  });
});
