const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const parseAiJson = (text: string): unknown => {
  try {
    return JSON.parse(text.trim());
  } catch {
    // Preserve literal markup inside already valid JSON before unwrapping.
  }
  const source = text.trim().replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    .replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
  try {
    return JSON.parse(source);
  } catch {
    // Some endpoints wrap their JSON in a preamble or a Markdown fence.
  }
  const start = source.search(/[\[{]/);
  if (start >= 0) {
    const stack: string[] = [];
    let quoted = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' || char === ']') {
        if (stack.pop() !== (char === '}' ? '{' : '[')) break;
        if (stack.length === 0) {
          try {
            return JSON.parse(source.slice(start, index + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new Error('AI 返回的 JSON 格式不完整或无效，已取消本次生成，请重试或更换模型。');
};

export const parseChatResponse = (text: string): Record<string, unknown> => {
  const parsed = parseAiJson(text);
  if (!isRecord(parsed)) throw new Error('AI 回复必须是包含 reply 数组的 JSON 对象。');
  let reply = parsed.reply;
  if (typeof reply === 'string') {
    if (/^[\[{]/.test(reply.trim())) {
      const nested = parseAiJson(reply);
      reply = isRecord(nested) ? nested.reply : nested;
    } else {
      reply = [reply];
    }
  }
  if (!Array.isArray(reply) || reply.length === 0) throw new Error('AI 回复缺少有效的 reply 消息数组。');
  if (parsed.thought !== undefined && typeof parsed.thought !== 'string') {
    throw new Error('AI 回复的 thought 心声必须是字符串。');
  }
  if (parsed.speakerId !== undefined && typeof parsed.speakerId !== 'string') {
    throw new Error('AI 回复的 speakerId 必须是字符串。');
  }
  for (const part of reply) {
    if ((typeof part !== 'string' && !isRecord(part)) || (typeof part === 'string' && !part.trim())) {
      throw new Error('AI 回复的 reply 包含空消息或无效消息格式。');
    }
    if (isRecord(part)) {
      if (['text', 'content', 'title', 'kind'].some((key) => part[key] !== undefined && typeof part[key] !== 'string')) {
        throw new Error('AI 回复的消息类型和正文必须是字符串。');
      }
      const hasBody = [part.text, part.content, part.kind === 'link' ? part.title : undefined]
        .some((value) => typeof value === 'string' && value.trim());
      const hasSticker = typeof part.stickerId === 'string' && !!part.stickerId.trim();
      if (!hasBody && !hasSticker && !['sticker', 'pat', 'red-packet', 'transfer'].includes(String(part.kind))) {
        throw new Error('AI 回复的 reply 包含缺少正文的消息对象。');
      }
    }
    const content = typeof part === 'string' ? part : isRecord(part) ? part.text ?? part.content : undefined;
    if (typeof content === 'string' && /```(?:json)?|[{\[]\s*"(?:reply|thought|speakerId|kind|text)"|"(?:reply|thought|speakerId)"\s*:/.test(content)) {
      throw new Error('AI 把消息元数据写进了正文，已取消本次生成，请重试。');
    }
  }
  return { ...parsed, reply };
};

export const parseForumPost = (text: string): { title: string; content: string; comments: unknown[]; authorHandle?: string } => {
  const parsed = parseAiJson(text);
  const post = isRecord(parsed) && isRecord(parsed.post) ? parsed.post : parsed;
  if (!isRecord(post) || typeof post.content !== 'string' || !post.content.trim() ||
    (post.title !== undefined && typeof post.title !== 'string') ||
    (post.comments !== undefined && !Array.isArray(post.comments))) {
    throw new Error('AI 返回的帖子数据格式不正确，请重试。');
  }
  return {
    ...(typeof post.authorHandle === 'string' ? { authorHandle: post.authorHandle } : {}),
    title: typeof post.title === 'string' ? post.title.trim() : '',
    content: post.content.trim(),
    comments: Array.isArray(post.comments) ? post.comments : [],
  };
};
