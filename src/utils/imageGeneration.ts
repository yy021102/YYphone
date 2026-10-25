import { ApiConnection, requestConfiguredImage } from './aiApi';
import { readSetting, SETTINGS_KEYS } from './settings';
import { parseImageReference, referenceGuidance, referenceSimilarity } from './imageReference';

export type ImageGenerationProvider = 'openai' | 'novelai' | 'imagen' | 'gemini';
export type ImageSizePreset = 'square' | 'portrait' | 'landscape';
export const isImageSizePreset = (value: unknown): value is ImageSizePreset => value === 'square' || value === 'portrait' || value === 'landscape';
export const defaultImageSize = (provider: ImageGenerationProvider): ImageSizePreset => provider === 'novelai' ? 'portrait' : 'square';
export function imageDimensions(provider: ImageGenerationProvider, size = defaultImageSize(provider)) {
  if (!isImageSizePreset(size)) throw new Error('图片尺寸选项无效，请重新选择。');
  const dimensions = provider === 'novelai'
    ? { square: [1024, 1024], portrait: [832, 1216], landscape: [1216, 832] }
    : { square: [1024, 1024], portrait: [1024, 1536], landscape: [1536, 1024] };
  const [width, height] = dimensions[size];
  const aspectRatio = { square: '1:1', portrait: '3:4', landscape: '4:3' }[size];
  return { width, height, size: `${width}x${height}`, aspectRatio };
}
export const imageSizeOptions = (provider: ImageGenerationProvider) => (['square', 'portrait', 'landscape'] as const).map((value) => {
  const dimensions = imageDimensions(provider, value);
  return { value, label: `${{ square: '正方形', portrait: '竖图', landscape: '横图' }[value]} · ${provider === 'gemini' || provider === 'imagen' ? dimensions.aspectRatio : `${dimensions.width} × ${dimensions.height}`}` };
});

export const IMAGE_PROVIDER_OPTIONS: Array<{ value: ImageGenerationProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI 兼容（/images/generations）' },
  { value: 'novelai', label: 'NovelAI' },
  { value: 'imagen', label: 'Google Imagen' },
  { value: 'gemini', label: 'Gemini Image' },
];

export const isImageGenerationProvider = (value: unknown): value is ImageGenerationProvider =>
  value === 'openai' || value === 'novelai' || value === 'imagen' || value === 'gemini';

const GOOGLE_BASE = 'https://generativelanguage.googleapis.com';

export const IMAGE_PROVIDER_DEFAULTS: Record<ImageGenerationProvider, { endpoint: string; model: string }> = {
  openai: { endpoint: '', model: 'gpt-image-1' },
  novelai: { endpoint: 'https://image.novelai.net', model: 'nai-diffusion-4-5-full' },
  imagen: { endpoint: GOOGLE_BASE, model: 'imagen-4.0-generate-001' },
  gemini: { endpoint: GOOGLE_BASE, model: 'gemini-2.5-flash-image' },
};

export interface ImageGenerationConfig {
  provider: ImageGenerationProvider;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  prompt?: string;
  size?: ImageSizePreset;
  referenceImage?: string;
  referenceSimilarity?: number;
}

export interface ImageGenerationSettings {
  provider: ImageGenerationProvider;
  endpoint: string;
  apiKey: string;
  model: string;
  size?: ImageSizePreset;
}

export const DEFAULT_IMAGE_GENERATION_SETTINGS: ImageGenerationSettings = {
  provider: 'openai',
  endpoint: '',
  apiKey: '',
  model: '',
};

export const isImageGenerationSettings = (value: unknown): value is ImageGenerationSettings =>
  !!value &&
  typeof value === 'object' &&
  isImageGenerationProvider((value as ImageGenerationSettings).provider) &&
  typeof (value as ImageGenerationSettings).endpoint === 'string' &&
  typeof (value as ImageGenerationSettings).apiKey === 'string' &&
  typeof (value as ImageGenerationSettings).model === 'string' &&
  ((value as ImageGenerationSettings).size === undefined || isImageSizePreset((value as ImageGenerationSettings).size));

export const readImageGenerationSettings = () =>
  readSetting(SETTINGS_KEYS.imageGeneration, DEFAULT_IMAGE_GENERATION_SETTINGS, isImageGenerationSettings);

const parseHttpUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('生图接口地址无效。');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('生图接口必须使用 HTTP 或 HTTPS。');
  return url;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const blobToDataUrl = async (blob: Blob, fallbackType = 'image/png') =>
  `data:${blob.type || fallbackType};base64,${bytesToBase64(new Uint8Array(await blob.arrayBuffer()))}`;

const inflateRaw = async (data: Uint8Array) => {
  if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持解压 NovelAI 返回的图片。');
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

// NovelAI returns a zip archive; read the first entry via the central directory.
export const extractFirstZipEntry = async (zip: Uint8Array) => {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let index = zip.length - 22; index >= Math.max(0, zip.length - 65557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error('NovelAI 返回的压缩包格式无效。');
  const central = view.getUint32(eocd + 16, true);
  if (view.getUint32(central, true) !== 0x02014b50) throw new Error('NovelAI 返回的压缩包格式无效。');
  const method = view.getUint16(central + 10, true);
  const compressedSize = view.getUint32(central + 20, true);
  const localOffset = view.getUint32(central + 42, true);
  if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('NovelAI 返回的压缩包格式无效。');
  const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
  const data = zip.subarray(dataStart, dataStart + compressedSize);
  if (method === 0) return data;
  if (method === 8) return inflateRaw(data);
  throw new Error('NovelAI 返回的图片使用了不支持的压缩方式。');
};

const readError = async (response: Response) =>
  `生图失败（HTTP ${response.status}）：${(await response.text().catch(() => '')).slice(0, 300) || response.statusText}`;

const requestNovelAiImage = async (prompt: string, endpoint: string, apiKey: string, model: string, config: ImageGenerationConfig, signal?: AbortSignal) => {
  const base = endpoint.replace(/\/+$/, '');
  const url = parseHttpUrl(/\/ai\/generate-image$/i.test(base) ? base : `${base}/ai/generate-image`);
  const negative = 'lowres, bad anatomy, bad hands, text, error, worst quality, low quality, jpeg artifacts, watermark';
  const isV4 = /nai-diffusion-4/i.test(model);
  const dimensions = imageDimensions('novelai', config.size);
  const reference = config.referenceImage ? parseImageReference(config.referenceImage) : undefined;
  const response = await fetch(url, {
    signal,
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: prompt,
      model,
      action: reference ? 'img2img' : 'generate',
      parameters: {
        width: dimensions.width,
        height: dimensions.height,
        ...(reference ? { image: reference.data, strength: Math.min(0.99, Math.max(0.01, 1 - referenceSimilarity(config.referenceSimilarity))), noise: 0 } : {}),
        scale: 5,
        sampler: 'k_euler_ancestral',
        steps: 28,
        n_samples: 1,
        seed: Math.floor(Math.random() * 4294967295),
        ucPreset: 0,
        qualityToggle: true,
        negative_prompt: negative,
        ...(isV4
          ? {
              params_version: 3,
              use_coords: false,
              v4_prompt: { caption: { base_caption: prompt, char_captions: [] }, use_coords: false, use_order: true },
              v4_negative_prompt: { caption: { base_caption: negative, char_captions: [] } },
            }
          : {}),
      },
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.startsWith('image/')) return blobToDataUrl(new Blob([bytes], { type: contentType }));
  const image = await extractFirstZipEntry(bytes);
  return `data:image/png;base64,${bytesToBase64(image)}`;
};

const googleUrl = (endpoint: string, model: string, action: 'predict' | 'generateContent') => {
  const base = endpoint.replace(/\/+$/, '');
  const pattern = new RegExp(`:${action}$`, 'i');
  return parseHttpUrl(pattern.test(base)
    ? base
    : `${base.replace(/\/v1beta$/i, '')}/v1beta/models/${encodeURIComponent(model)}:${action}`);
};

const requestImagenImage = async (prompt: string, endpoint: string, apiKey: string, model: string, config: ImageGenerationConfig, signal?: AbortSignal) => {
  const response = await fetch(googleUrl(endpoint, model, 'predict'), {
    signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: imageDimensions('imagen', config.size).aspectRatio } }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json() as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };
  const prediction = payload.predictions?.find((item) => item.bytesBase64Encoded);
  if (!prediction?.bytesBase64Encoded) throw new Error('Imagen 没有返回图片，可能被安全策略拦截。');
  return `data:${prediction.mimeType || 'image/png'};base64,${prediction.bytesBase64Encoded}`;
};

const requestGeminiImage = async (prompt: string, endpoint: string, apiKey: string, model: string, config: ImageGenerationConfig, signal?: AbortSignal) => {
  const reference = config.referenceImage ? parseImageReference(config.referenceImage) : undefined;
  const response = await fetch(googleUrl(endpoint, model, 'generateContent'), {
    signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [...(reference ? [{ inlineData: { mimeType: reference.mimeType, data: reference.data } }] : []), { text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: imageDimensions('gemini', config.size).aspectRatio } },
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
  };
  const inline = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!inline?.data) throw new Error('Gemini 没有返回图片，可能被安全策略拦截或模型不支持图片输出。');
  return `data:${inline.mimeType || 'image/png'};base64,${inline.data}`;
};

export const generateImage = async (
  description: string,
  config: ImageGenerationConfig,
  fallbackApi?: ApiConnection,
  signal?: AbortSignal,
): Promise<string> => {
  const provider = config.provider;
  if (config.referenceImage && provider === 'imagen') throw new Error('当前 Imagen 文生图接口不支持参考图，请切换到支持参考图的 OpenAI 兼容、Gemini Image 或 NovelAI。');
  if (config.referenceImage) parseImageReference(config.referenceImage);
  const defaults = IMAGE_PROVIDER_DEFAULTS[provider];
  const fallbackMatches = !!fallbackApi && (provider === 'openai'
    ? !fallbackApi.endpoint.includes('generativelanguage.googleapis.com')
    : (provider === 'imagen' || provider === 'gemini') && fallbackApi.endpoint.includes('generativelanguage.googleapis.com'));
  const endpoint = config.endpoint?.trim() ||
    (provider === 'openai' && fallbackMatches ? fallbackApi!.endpoint.trim() : '') || defaults.endpoint;
  const apiKey = config.apiKey?.trim() || (fallbackMatches ? fallbackApi!.apiKey.trim() : '');
  const model = config.model?.trim() || defaults.model;
  const prompt = [config.prompt?.trim(), description.trim(), config.referenceImage && provider !== 'novelai' ? referenceGuidance(referenceSimilarity(config.referenceSimilarity)) : ''].filter(Boolean).join(provider === 'novelai' ? ', ' : '\n');
  if (!endpoint) throw new Error('生图接口地址未填写。');
  if (!apiKey) throw new Error('生图 API Key 未填写。');
  if (!prompt) throw new Error('生图提示词为空。');

  switch (provider) {
    case 'novelai':
      return requestNovelAiImage(prompt, endpoint, apiKey, model, config, signal);
    case 'imagen':
      return requestImagenImage(prompt, endpoint, apiKey, model, config, signal);
    case 'gemini':
      return requestGeminiImage(prompt, endpoint, apiKey, model, config, signal);
    default:
      return requestConfiguredImage(prompt, { model, api: { endpoint, apiKey }, size: imageDimensions(provider, config.size).size,
        referenceImage: config.referenceImage, similarity: config.referenceSimilarity, signal });
  }
};
