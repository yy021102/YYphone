const DATABASE_NAME = 'yyphone_db';
const STORE_NAME = 'store';
const DATABASE_VERSION = 1;

interface StorageRecord {
  key: string;
  value: unknown;
}

const memoryCache = new Map<string, unknown>();
let databasePromise: Promise<IDBDatabase | null> | undefined;
let initialized = false;
let indexedDbAvailable = typeof window !== 'undefined' && 'indexedDB' in window;

const parseLocalStorageValue = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const readLegacyEntries = (): Array<{ key: string; value: unknown }> => {
  try {
    const entries: Array<{ key: string; value: unknown }> = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key === null) continue;
      const rawValue = window.localStorage.getItem(key);
      if (rawValue !== null) entries.push({ key, value: parseLocalStorageValue(rawValue) });
    }
    return entries;
  } catch (error) {
    console.warn('Could not read legacy localStorage data; continuing with available storage.', error);
    return [];
  }
};

const openDatabase = (): Promise<IDBDatabase | null> => {
  if (!indexedDbAvailable) return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('Could not open IndexedDB; using localStorage fallback.', request.error);
        indexedDbAvailable = false;
        resolve(null);
      };
      request.onblocked = () => {
        console.warn('IndexedDB upgrade is blocked; using localStorage fallback.');
        indexedDbAvailable = false;
        resolve(null);
      };
    } catch (error) {
      console.error('IndexedDB is unavailable; using localStorage fallback.', error);
      indexedDbAvailable = false;
      resolve(null);
    }
  });
  return databasePromise;
};

const requestResult = <T,>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });

const transactionComplete = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });

const migrateLocalStorage = async (database: IDBDatabase): Promise<string[]> => {
  const legacyEntries = readLegacyEntries();

  if (legacyEntries.length > 0) {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const entry of legacyEntries) {
      const getRequest = store.get(entry.key);
      getRequest.onsuccess = () => {
        if (getRequest.result === undefined) {
          store.put({ key: entry.key, value: entry.value } satisfies StorageRecord);
        }
      };
    }
    await transactionComplete(transaction);

  }
  return legacyEntries.map(({ key }) => key);
};

const loadCache = async (database: IDBDatabase): Promise<void> => {
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const records = await requestResult(transaction.objectStore(STORE_NAME).getAll() as IDBRequest<StorageRecord[]>);
  await transactionComplete(transaction);
  memoryCache.clear();
  records.forEach((record) => {
    if (record && typeof record.key === 'string') memoryCache.set(record.key, record.value);
  });
};

export async function initializeDbStorage(): Promise<void> {
  if (initialized) return;
  const database = await openDatabase();
  if (!database) {
    memoryCache.clear();
    readLegacyEntries().forEach(({ key, value }) => memoryCache.set(key, value));
    initialized = true;
    return;
  }

  try {
    const migratedKeys = await migrateLocalStorage(database);
    await loadCache(database);
    migratedKeys.forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Could not remove migrated localStorage key "${key}".`, error);
      }
    });
    initialized = true;
  } catch (error) {
    console.error('Could not migrate local data to IndexedDB; using localStorage fallback.', error);
    indexedDbAvailable = false;
    database.close();
    databasePromise = Promise.resolve(null);
    memoryCache.clear();
    readLegacyEntries().forEach(({ key, value }) => memoryCache.set(key, value));
    initialized = true;
  }
}

export async function getStorageItem(key: string): Promise<any> {
  await initializeDbStorage();
  if (memoryCache.has(key)) return memoryCache.get(key);
  const database = await openDatabase();
  if (!database) {
    const rawValue = window.localStorage.getItem(key);
    if (rawValue === null) return undefined;
    const value = parseLocalStorageValue(rawValue);
    memoryCache.set(key, value);
    return value;
  }

  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(key) as IDBRequest<StorageRecord | undefined>);
    await transactionComplete(transaction);
    if (record) memoryCache.set(key, record.value);
    return record?.value;
  } catch (error) {
    console.error(`Could not read IndexedDB key "${key}"; using localStorage fallback.`, error);
    const rawValue = window.localStorage.getItem(key);
    return rawValue === null ? undefined : parseLocalStorageValue(rawValue);
  }
}

export async function setStorageItem(key: string, value: any): Promise<void> {
  await initializeDbStorage();
  memoryCache.set(key, value);
  const database = await openDatabase();
  if (!database) {
    window.localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ key, value } satisfies StorageRecord);
    await transactionComplete(transaction);
  } catch (error) {
    console.error(`Could not write IndexedDB key "${key}"; using localStorage fallback.`, error);
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

export async function removeStorageItem(key: string): Promise<void> {
  await initializeDbStorage();
  memoryCache.delete(key);
  const database = await openDatabase();
  if (!database) {
    window.localStorage.removeItem(key);
    return;
  }
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(key);
    await transactionComplete(transaction);
  } catch (error) {
    console.error(`Could not remove IndexedDB key "${key}"; using localStorage fallback.`, error);
    window.localStorage.removeItem(key);
  }
}

export function getCachedStorageItem(key: string): { found: boolean; value?: unknown } {
  return memoryCache.has(key)
    ? { found: true, value: memoryCache.get(key) }
    : { found: false };
}

export function setCachedStorageItem(key: string, value: unknown): void {
  memoryCache.set(key, value);
  void setStorageItem(key, value).catch((error: unknown) => {
    console.error(`Could not persist storage key "${key}".`, error);
  });
}

export function removeCachedStorageItem(key: string): void {
  memoryCache.delete(key);
  void removeStorageItem(key).catch((error: unknown) => {
    console.error(`Could not remove storage key "${key}".`, error);
  });
}

export function getAllCachedStorageItems(): Record<string, string> {
  const result: Record<string, string> = {};
  memoryCache.forEach((value, key) => {
    result[key] = JSON.stringify(value) ?? 'null';
  });
  return result;
}

export async function clearDbStorage(): Promise<void> {
  await initializeDbStorage();
  memoryCache.clear();
  window.localStorage.clear();
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).clear();
  await transactionComplete(transaction);
}

export async function replaceDbStorage(values: Record<string, unknown>): Promise<void> {
  await initializeDbStorage();
  memoryCache.clear();
  window.localStorage.clear();
  const database = await openDatabase();
  if (!database) {
    Object.entries(values).forEach(([key, value]) => {
      memoryCache.set(key, value);
      window.localStorage.setItem(key, JSON.stringify(value));
    });
    return;
  }
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.clear();
  Object.entries(values).forEach(([key, rawValue]) => {
    const value = typeof rawValue === 'string' ? parseLocalStorageValue(rawValue) : rawValue;
    memoryCache.set(key, value);
    store.put({ key, value } satisfies StorageRecord);
  });
  await transactionComplete(transaction);
}
