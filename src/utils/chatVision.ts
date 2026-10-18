import type { OpenAiMessage } from './buildPrompt';

export const toOpenAiMessages = (messages: OpenAiMessage[]) =>
  messages.map(({ role, content, images }) => ({
    role,
    content: images?.length
      ? [
          { type: 'text' as const, text: content },
          ...images.map((url) => ({
            type: 'image_url' as const,
            image_url: { url, detail: 'high' as const },
          })),
        ]
      : content,
  }));

export const toGeminiContents = (messages: OpenAiMessage[]) =>
  messages.filter((message) => message.role !== 'system').map(({ role, content, images }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [
      { text: content },
      ...(images ?? []).map((url) => {
        const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(url);
        if (!match) {
          throw new Error('Gemini 图片消息需要 JPEG、PNG、WebP 或 GIF 的 Base64 数据，请重新上传本地图片。');
        }
        return { inlineData: { mimeType: match[1], data: match[2] } };
      }),
    ],
  }));
