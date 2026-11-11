type Row = Record<string, unknown>;
const row = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const contentText = (value: unknown): string => typeof value === 'string' ? value : Array.isArray(value)
  ? value.flatMap(part => row(part) && part.thought !== true && typeof part.text === 'string' ? [part.text] : []).join('') : '';

function readPayload(payload: unknown, google: boolean, streaming: boolean) {
  if (!row(payload)) throw new Error('AI 返回的数据格式无效。');
  if (payload.error) {
    const message = row(payload.error) && typeof payload.error.message === 'string' ? payload.error.message : 'AI 返回了错误。';
    throw new Error(message);
  }
  const candidates = google ? payload.candidates : payload.choices;
  const candidate = Array.isArray(candidates) ? candidates.find(item => row(item) && (item.index === undefined || item.index === 0)) : undefined;
  if (!row(candidate)) return { text: '', finished: false };
  const finish = google ? candidate.finishReason : candidate.finish_reason;
  if (finish === 'length' || finish === 'MAX_TOKENS') throw new Error('已达到最大输出 Token 数，回复未完成。请调高上限后重试。');
  const content = google ? row(candidate.content) ? candidate.content.parts : undefined
    : row(streaming ? candidate.delta : candidate.message) ? (streaming ? candidate.delta as Row : candidate.message as Row).content : undefined;
  return { text: contentText(content), finished: typeof finish === 'string' && !!finish };
}

/** Receive complete text before callers validate JSON or commit any generated actions. */
export async function readAiTextResponse(response: Response, google: boolean, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  if (!response.ok) throw new Error(`AI 请求失败（HTTP ${response.status}）：${await response.text()}`);
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
    const payload: unknown = await response.json();
    signal?.throwIfAborted();
    return readPayload(payload, google, false).text;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('AI 流式响应为空。');
  const decoder = new TextDecoder();
  let buffer = '', data: string[] = [], text = '', finished = false, doneMarker = false, size = 0;
  const event = () => {
    if (!data.length) return;
    const value = data.join('\n').trim(); data = [];
    if (!value) return;
    if (value === '[DONE]') { doneMarker = true; finished = true; return; }
    let payload: unknown;
    try { payload = JSON.parse(value); } catch { throw new Error('AI 流式数据格式无效，未保存本次生成。'); }
    const part = readPayload(payload, google, true);
    text += part.text; finished ||= part.finished;
  };
  const line = (value: string) => {
    if (!value) { event(); return; }
    if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, ''));
  };
  const consume = (final = false) => {
    // Keep a trailing CR until the next network chunk, so CRLF can span chunks.
    let match: RegExpExecArray | null;
    while ((match = /\r\n|\n|\r(?!$)/.exec(buffer))) {
      line(buffer.slice(0, match.index)); buffer = buffer.slice(match.index + match[0].length);
      if (doneMarker) { buffer = ''; break; }
    }
    if (final && !doneMarker) { line(buffer.replace(/\r$/, '')); buffer = ''; event(); }
  };
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    while (!doneMarker) {
      const chunk = await reader.read(); signal?.throwIfAborted();
      if (chunk.done) { buffer += decoder.decode(); consume(true); break; }
      size += chunk.value.byteLength;
      if (size > 8 * 1024 * 1024) throw new Error('AI 流式响应过大，已停止接收。');
      buffer += decoder.decode(chunk.value, { stream: true }); consume();
    }
    signal?.throwIfAborted();
    if (!finished) throw new Error('AI 流式连接提前结束，未保存不完整回复，请重试。');
    return text;
  } finally {
    signal?.removeEventListener('abort', abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
