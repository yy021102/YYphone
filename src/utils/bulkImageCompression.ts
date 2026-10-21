import { setStorageItem } from './dbStorage';
import { readStoredValue } from './localStorage';
import { compressImage } from './imageFile';
import { MOMENTS_STORAGE_KEY } from './momentsData';

const CHAT_STORAGE_KEY = 'yyphone:wechat-chats';
const FORUM_POSTS_STORAGE_KEY = 'yyphone:forum-posts';
const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

const compressDataUrl = async (url: string) => {
  if (!url.startsWith('data:image/')) return url;
  const response = await fetch(url);
  const blob = await response.blob();
  const file = new File([blob], 'uploaded-image', { type: blob.type || 'image/jpeg' });
  return compressImage(file, { maxDimension: 1024, maxBytes: 280 * 1024 });
};

const recordWithCompressedImage = async (
  value: unknown,
  field: 'imageUrl'
): Promise<{ value: unknown; changed: boolean }> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { value, changed: false };
  const record = value as Record<string, unknown>;
  if (typeof record[field] !== 'string') return { value, changed: false };
  const image = await compressDataUrl(record[field] as string);
  return image === record[field]
    ? { value, changed: false }
    : { value: { ...record, [field]: image }, changed: true };
};

const compressMessageList = async (messages: unknown[]) => {
  let changed = false;
  let count = 0;
  const nextMessages: unknown[] = [];
  for (const message of messages) {
    if (!message || typeof message !== 'object' || (message as Record<string, unknown>).kind !== 'image') {
      nextMessages.push(message);
      continue;
    }
    const result = await recordWithCompressedImage(message, 'imageUrl');
    if (result.changed) {
      changed = true;
      count += 1;
    }
    nextMessages.push(result.value);
  }
  return { messages: nextMessages, changed, count };
};

export async function compressUploadedImages(): Promise<number> {
  let compressedCount = 0;
  let chatsChanged = false;
  let momentsChanged = false;
  let forumPostsChanged = false;
  const chats = readStoredValue<unknown[]>(CHAT_STORAGE_KEY, [], isUnknownArray);
  let nextChats: unknown[] = chats;
  if (Array.isArray(chats)) {
    nextChats = [];
    for (const chat of chats) {
      if (!chat || typeof chat !== 'object' || !Array.isArray((chat as Record<string, unknown>).messages)) {
        nextChats.push(chat);
        continue;
      }
      const record = chat as Record<string, unknown>;
      const messageResult = await compressMessageList(record.messages as unknown[]);
      compressedCount += messageResult.count;
      let archivesChanged = false;
      let archives: unknown[] = [];
      if (Array.isArray(record.archives)) {
        for (const archive of record.archives) {
          if (!archive || typeof archive !== 'object' || !Array.isArray((archive as Record<string, unknown>).messages)) {
            archives.push(archive);
            continue;
          }
          const archiveRecord = archive as Record<string, unknown>;
          const archiveMessages = await compressMessageList(archiveRecord.messages as unknown[]);
          compressedCount += archiveMessages.count;
          if (archiveMessages.changed) {
            archivesChanged = true;
            archives.push({ ...archiveRecord, messages: archiveMessages.messages });
          } else {
            archives.push(archive);
          }
        }
      }
      if (messageResult.changed || archivesChanged) {
        chatsChanged = true;
        nextChats.push({
          ...record,
          ...(messageResult.changed ? { messages: messageResult.messages } : {}),
          ...(archivesChanged ? { archives } : {}),
        });
      } else {
        nextChats.push(chat);
      }
    }
  }

  const moments = readStoredValue<unknown[]>(MOMENTS_STORAGE_KEY, [], isUnknownArray);
  let nextMoments: unknown[] = moments;
  if (Array.isArray(moments)) {
    nextMoments = [];
    for (const post of moments) {
      if (!post || typeof post !== 'object' || !Array.isArray((post as Record<string, unknown>).images)) {
        nextMoments.push(post);
        continue;
      }
      const record = post as Record<string, unknown>;
      let postChanged = false;
      const images: unknown[] = [];
      for (const image of record.images as unknown[]) {
        if (typeof image !== 'string') {
          images.push(image);
          continue;
        }
        const nextImage = await compressDataUrl(image);
        if (nextImage !== image) {
          postChanged = true;
          compressedCount += 1;
        }
        images.push(nextImage);
      }
      if (postChanged) {
        momentsChanged = true;
        nextMoments.push({ ...record, images });
      } else {
        nextMoments.push(post);
      }
    }
  }

  const forumPosts = readStoredValue<unknown[]>(FORUM_POSTS_STORAGE_KEY, [], isUnknownArray);
  let nextForumPosts: unknown[] = forumPosts;
  if (Array.isArray(forumPosts)) {
    nextForumPosts = [];
    for (const post of forumPosts) {
      const result = await recordWithCompressedImage(post, 'imageUrl');
      if (result.changed) {
        forumPostsChanged = true;
        compressedCount += 1;
      }
      nextForumPosts.push(result.value);
    }
  }
  if (chatsChanged) await setStorageItem(CHAT_STORAGE_KEY, nextChats);
  if (momentsChanged) await setStorageItem(MOMENTS_STORAGE_KEY, nextMoments);
  if (forumPostsChanged) await setStorageItem(FORUM_POSTS_STORAGE_KEY, nextForumPosts);
  return compressedCount;
}
