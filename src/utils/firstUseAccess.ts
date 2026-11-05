// Only a digest belongs in the client bundle; never put the original access phrase here.
export const DEFAULT_FIRST_USE_PASSWORD_HASH = 'b27ec1cc1f67fcbf847c1da16b40b4650cc5eea43c296e9bfbca638c034a46e2';
export const normalizeAccessHash = (v: string) => /^[a-f\d]{64}$/i.test(v.trim()) ? v.trim().toLowerCase() : '';
export async function accessPhraseHash(phrase: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(phrase));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
// Independent of device backups: restoring someone else's phone must not authorize this browser.
const DB = 'yyphone-entry-access';
async function accessStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('access');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('浏览器暂时无法保存验证状态。'));
    request.onblocked = () => reject(new Error('验证记录正在被其他页面使用，请关闭旧页面重试。'));
  });
}
export async function hasFirstUseAccess(hash: string, scope: string): Promise<boolean> {
  let db: IDBDatabase | undefined;
  try {
    db = await accessStore();
    return await new Promise<boolean>((resolve, reject) => {
      const transaction = db!.transaction('access', 'readonly');
      const request = transaction.objectStore('access').get(`${scope}:${hash}`);
      transaction.oncomplete = () => resolve(request.result === true);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch { return false; } finally { db?.close(); }
}
export async function rememberFirstUseAccess(hash: string, scope: string): Promise<void> {
  const db = await accessStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('access', 'readwrite');
      transaction.objectStore('access').put(true, `${scope}:${hash}`);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('口令正确，但浏览器无法保存验证状态，请检查存储权限后重试。'));
      transaction.onabort = () => reject(new Error('验证状态保存中断，请重试。'));
    });
  } finally { db.close(); }
}
