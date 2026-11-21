type AccessRecord = { device: string; token?: string };
const DATABASE = 'yyphone-account-authorization';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('credentials');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法读取登录存储，请检查浏览器是否允许网站保存数据。'));
  });
}
export async function readAccountAccess(): Promise<AccessRecord> {
  const db = await database();
  try {
    const record = await new Promise<AccessRecord | undefined>((resolve, reject) => {
      const transaction = db.transaction('credentials', 'readonly');
      const request = transaction.objectStore('credentials').get('current');
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
    });
    if (record?.device) return record;
  } finally { db.close(); }
  const record = { device: Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('') };
  await saveAccountAccess(record);return record;
}
export async function saveAccountAccess(record: AccessRecord) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('credentials', 'readwrite');
    transaction.objectStore('credentials').put(record, 'current');
    transaction.oncomplete = () => resolve();transaction.onerror = () => reject(transaction.error);
  }); } finally { db.close(); }
}
export async function accessRequest(base: string, action: string, data: unknown = {}) {
  const record = await readAccountAccess();
  const response = await fetch(base + '/api/client/' + action, {
    method: 'POST', credentials: 'omit', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-Phone-Device': record.device, ...(record.token ? { Authorization: 'Bearer ' + record.token } : {}) },
    body: JSON.stringify(data), signal: AbortSignal.timeout(20000)
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || '验证未完成，请稍后重试。'), { status: response.status });
  if (result.token) await saveAccountAccess({ device: record.device, token: result.token });
  return result;
}
export async function forgetAccountSession() {
  const record = await readAccountAccess();await saveAccountAccess({ device: record.device });
}
