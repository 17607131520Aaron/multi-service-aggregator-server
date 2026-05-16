import {
  detectImageMimeType,
  mimeTypeToExtension,
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
});
