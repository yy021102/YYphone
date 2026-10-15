const DATABASE_NAME = 'yyphone_audio_db';
const STORE_NAME = 'files';

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('当前浏览器不支持本地音频存储。'));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开音频存储。'));
  });

const run = async <T,>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? new Error('音频存储失败。'));
      transaction.onabort = () => reject(transaction.error ?? new Error('音频存储失败，可能是存储空间不足。'));
    });
  } finally {
    database.close();
  }
};

// 本地音频文件体积较大，单独存放在 IndexedDB 中，不进入整机备份与内存缓存。
export const saveAudioBlob = (id: string, blob: Blob): Promise<IDBValidKey> =>
  run('readwrite', (store) => store.put(blob, id));

export const getAudioBlob = async (id: string): Promise<Blob | undefined> => {
  const value = await run<unknown>('readonly', (store) => store.get(id));
  return value instanceof Blob ? value : undefined;
};

export const deleteAudioBlob = (id: string): Promise<undefined> =>
  run('readwrite', (store) => store.delete(id));

export const clearAudioBlobs = (): Promise<undefined> =>
  run('readwrite', (store) => store.clear());
