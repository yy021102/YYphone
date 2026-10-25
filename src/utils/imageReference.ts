// References are local, compressed uploads; never fetch arbitrary URLs as source images.
export const isImageReference = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 600_000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);

export function parseImageReference(value: string) {
  if (!isImageReference(value)) throw new Error('参考图无效，请重新上传 JPG、PNG 或 WebP 图片。');
  const [header, data] = value.split(',');
  const mimeType = header.slice(5, header.indexOf(';'));
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return { mimeType, data, blob: new Blob([bytes], { type: mimeType }) };
}

export function referenceSimilarity(value: number | undefined) {
  const similarity = value ?? 0.7;
  if (!Number.isFinite(similarity) || similarity < 0 || similarity > 1) throw new Error('参考图相似度需在 0% 到 100% 之间。');
  return similarity;
}

export const referenceGuidance = (similarity: number) =>
  `请参考附带图片生成新图。参考强度 ${Math.round(similarity * 100)}%：${similarity >= 0.65 ? '尽量保留主体外观、色彩与风格' : similarity >= 0.35 ? '兼顾参考图特征与新场景，自然变化构图' : '仅借鉴少量风格与色彩，允许较大变化'}。同时遵循本次画面描述，不添加参考图之外未经描述的身份信息。`;
