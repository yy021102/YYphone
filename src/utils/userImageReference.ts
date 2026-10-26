import type { UserPersona } from '../types';
import { isImageReference } from './imageReference';

export type ImageSubject = 'user' | 'character' | 'together' | 'other';
export interface GenerationReference {
  image: string;
  subject?: 'user' | 'character';
  similarity?: number;
}

export const parseImageSubject = (value: unknown): ImageSubject | undefined =>
  value === 'user' || value === 'character' || value === 'together' || value === 'other' ? value : undefined;

export const hasUserFaceReference = (persona?: UserPersona): boolean =>
  !!persona && persona.faceReferenceEnabled !== false && isImageReference(persona.faceReferenceImage);

export const validUserFaceFields = (persona: Record<string, unknown> | UserPersona) =>
  (persona.faceReferenceImage === undefined || persona.faceReferenceImage === '' || isImageReference(persona.faceReferenceImage)) &&
  (persona.faceReferenceEnabled === undefined || typeof persona.faceReferenceEnabled === 'boolean') &&
  (persona.faceReferenceSimilarity === undefined || (typeof persona.faceReferenceSimilarity === 'number' && Number.isFinite(persona.faceReferenceSimilarity) && persona.faceReferenceSimilarity >= 0 && persona.faceReferenceSimilarity <= 1));

// An absent/invalid subject never sends a player's private photo speculatively.
// Keep the existing chat reference behavior for older models and role/scenery images.
export function selectChatImageReferences(subject: ImageSubject | undefined, persona: UserPersona | undefined,
  chatImage?: string, chatSimilarity?: number): GenerationReference[] {
  const chatReference: GenerationReference[] = chatImage ? [{ image: chatImage, similarity: chatSimilarity }] : [];
  if (!hasUserFaceReference(persona) || (subject !== 'user' && subject !== 'together')) return chatReference;
  return [
    { image: persona!.faceReferenceImage!, subject: 'user', similarity: persona!.faceReferenceSimilarity ?? 0.85 },
    ...(subject === 'together' && chatImage ? [{ image: chatImage, subject: 'character' as const, similarity: chatSimilarity }] : []),
  ];
}

export const userFaceReferenceInstructions = (persona?: UserPersona) => hasUserFaceReference(persona)
  ? '玩家已保存自己的生图脸部参考照片。每条 image 消息必须额外返回 imageSubject：画面只有玩家用 "user"，只有角色用 "character"，玩家与角色合照用 "together"，风景、物品或其他人用 "other"。按画面中真正出现的人判断，不按发送者判断；“你的照片”指玩家、“我的自拍”指发言角色。程序只会为 user/together 附上玩家照片；照片只用于玩家的脸，不能套到角色或路人脸上。描述清楚谁在哪里、各自的动作，玩家面部以参考照片为准；换衣服、场景和姿势不必照搬照片。imageSubject 是 JSON 字段，不要写在聊天正文里。'
  : '';
