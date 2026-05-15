export type ParsedSseSegment = {
  event: string;
  data: string;
};

export type NormalizedStreamChunk = {
  delta: string;
  reasoning: string;
  finishReason: string;
  role: string;
  model: string | null;
  id: string | null;
  usage: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const readNestedString = (
  source: Record<string, unknown> | undefined,
  key: string,
): string => (source ? readString(source[key]) : '');

export const parseSseSegment = (segment: string): ParsedSseSegment | null => {
  const lines = segment.split(/\r?\n/);
  let event = 'message';
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      return;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  });

  if (dataLines.length === 0) {
    return null;
  }

  const data = dataLines.join('\n').trim();

  if (!data) {
    return null;
  }

  return { event, data };
};

export const extractStreamError = (payload: unknown): string | null => {
  if (!isRecord(payload)) {
    return null;
  }

  if (isRecord(payload.error)) {
    return (
      readString(payload.error.message) ||
      readString(payload.error.msg) ||
      readString(payload.error.code) ||
      '上游 AI 服务返回错误'
    );
  }

  if (payload.type === 'error') {
    return readString(payload.message) || readString(payload.error) || '上游 AI 服务返回错误';
  }

  return null;
};

const extractGeminiDelta = (payload: Record<string, unknown>): string => {
  const candidates = payload.candidates;

  if (!Array.isArray(candidates) || !isRecord(candidates[0])) {
    return '';
  }

  const content = candidates[0].content;

  if (!isRecord(content)) {
    return '';
  }

  const parts = content.parts;

  if (!Array.isArray(parts)) {
    return readString(content.text);
  }

  return parts
    .map((part) => {
      if (!isRecord(part)) {
        return '';
      }

      return readString(part.text);
    })
    .join('');
};

const extractAnthropicDelta = (payload: Record<string, unknown>): string => {
  const delta = payload.delta;

  if (!isRecord(delta)) {
    return '';
  }

  if (typeof delta.text === 'string') {
    return delta.text;
  }

  if (typeof delta.thinking === 'string') {
    return '';
  }

  return '';
};

const extractOpenAiDelta = (payload: Record<string, unknown>): string => {
  const choices = payload.choices;

  if (!Array.isArray(choices) || !isRecord(choices[0])) {
    return '';
  }

  const choice = choices[0];

  return (
    readNestedString(choice.delta as Record<string, unknown> | undefined, 'content') ||
    readNestedString(choice.message as Record<string, unknown> | undefined, 'content') ||
    readString(choice.text)
  );
};

const extractOpenAiReasoning = (payload: Record<string, unknown>): string => {
  const choices = payload.choices;

  if (!Array.isArray(choices) || !isRecord(choices[0])) {
    return '';
  }

  const delta = choices[0].delta;

  if (!isRecord(delta)) {
    return '';
  }

  return readString(delta.reasoning_content) || readString(delta.reasoning);
};

export const extractStreamDelta = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }

  const direct =
    readString(payload.delta) ||
    readString(payload.content) ||
    readString(payload.text) ||
    readString(payload.response) ||
    readString(payload.output_text) ||
    readString(payload.answer);

  if (direct) {
    return direct;
  }

  const anthropic = extractAnthropicDelta(payload);
  if (anthropic) {
    return anthropic;
  }

  const openAi = extractOpenAiDelta(payload);
  if (openAi) {
    return openAi;
  }

  const gemini = extractGeminiDelta(payload);
  if (gemini) {
    return gemini;
  }

  if (isRecord(payload.message)) {
    const messageDelta = readString(payload.message.content);
    if (messageDelta) {
      return messageDelta;
    }
  }

  if (isRecord(payload.output)) {
    const outputDelta =
      readString(payload.output.text) || readNestedString(payload.output, 'content');
    if (outputDelta) {
      return outputDelta;
    }
  }

  if (Array.isArray(payload.choices) && isRecord(payload.choices[0])) {
    const choice = payload.choices[0];
    const nestedDelta = choice.delta;

    if (isRecord(nestedDelta)) {
      return readString(nestedDelta.message) || readString(nestedDelta.content);
    }
  }

  return '';
};

export const extractStreamReasoning = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }

  const openAiReasoning = extractOpenAiReasoning(payload);
  if (openAiReasoning) {
    return openAiReasoning;
  }

  const delta = payload.delta;
  if (isRecord(delta)) {
    return readString(delta.thinking) || readString(delta.reasoning);
  }

  return '';
};

export const extractFinishReason = (payload: unknown): string => {
  if (!isRecord(payload)) {
    return '';
  }

  const choices = payload.choices;
  if (Array.isArray(choices) && isRecord(choices[0])) {
    return readString(choices[0].finish_reason);
  }

  if (isRecord(payload.delta)) {
    return readString(payload.delta.stop_reason);
  }

  return readString(payload.finish_reason) || readString(payload.stop_reason);
};

export const shouldEmitUpstreamChunk = (event: string, payload: unknown): boolean => {
  const delta = extractStreamDelta(payload);
  const reasoning = extractStreamReasoning(payload);

  if (delta || reasoning) {
    return true;
  }

  const ignoredEvents = new Set([
    'ping',
    'message_start',
    'content_block_start',
    'content_block_stop',
    'message_stop',
    'response.created',
    'response.completed',
    'response.output_item.added',
    'response.output_item.done',
  ]);

  if (ignoredEvents.has(event)) {
    return false;
  }

  if (event === 'message_delta' && isRecord(payload) && isRecord(payload.delta)) {
    return Boolean(readString(payload.delta.stop_reason));
  }

  return false;
};

export const normalizeUpstreamChunk = (payload: unknown): NormalizedStreamChunk => {
  const record = isRecord(payload) ? payload : {};

  return {
    delta: extractStreamDelta(payload),
    reasoning: extractStreamReasoning(payload),
    finishReason: extractFinishReason(payload),
    role:
      readNestedString(
        Array.isArray(record.choices) && isRecord(record.choices[0])
          ? (record.choices[0].delta as Record<string, unknown> | undefined)
          : undefined,
        'role',
      ) || 'assistant',
    model: readString(record.model) || null,
    id: readString(record.id) || null,
    usage: record.usage ?? null,
  };
};
