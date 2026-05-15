import {
  extractStreamDelta,
  extractStreamError,
  normalizeUpstreamChunk,
  parseSseSegment,
  shouldEmitUpstreamChunk,
} from '@/ai/upstream-stream.parser';

describe('upstream-stream.parser', () => {
  it('parses sse segment with event and data', () => {
    const parsed = parseSseSegment('event: chunk\ndata: {"delta":"hi"}');

    expect(parsed).toEqual({
      event: 'chunk',
      data: '{"delta":"hi"}',
    });
  });

  it('extracts openai delta', () => {
    expect(
      extractStreamDelta({
        choices: [{ delta: { content: 'hello' } }],
      }),
    ).toBe('hello');
  });

  it('extracts anthropic delta', () => {
    expect(
      extractStreamDelta({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'hello' },
      }),
    ).toBe('hello');
  });

  it('extracts gemini delta', () => {
    expect(
      extractStreamDelta({
        candidates: [{ content: { parts: [{ text: 'hello' }] } }],
      }),
    ).toBe('hello');
  });

  it('extracts ollama delta', () => {
    expect(
      extractStreamDelta({
        message: { content: 'hello' },
      }),
    ).toBe('hello');
  });

  it('extracts stream error', () => {
    expect(
      extractStreamError({
        error: { message: 'rate limited' },
      }),
    ).toBe('rate limited');
  });

  it('skips anthropic lifecycle events without text', () => {
    expect(
      shouldEmitUpstreamChunk('content_block_start', {
        type: 'content_block_start',
      }),
    ).toBe(false);
  });

  it('normalizes upstream chunk', () => {
    expect(
      normalizeUpstreamChunk({
        id: 'chat-1',
        model: 'gpt-4o',
        choices: [{ delta: { content: 'hi' }, finish_reason: null }],
      }),
    ).toMatchObject({
      delta: 'hi',
      id: 'chat-1',
      model: 'gpt-4o',
    });
  });
});
