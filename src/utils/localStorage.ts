import {
  getCachedStorageItem,
  setCachedStorageItem,
} from './dbStorage';

export function readStorageString(key: string): string | null {
  const cached = getCachedStorageItem(key);
  if (cached.found) return JSON.stringify(cached.value) ?? 'null';
  return window.localStorage.getItem(key);
}

export function writeStorageString(key: string, value: string): void {
  let parsed: unknown = value;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    // Preserve non-JSON legacy string values.
  }
  setCachedStorageItem(key, parsed);
}

export function readStoredValue<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T
): T {
  try {
    const cached = getCachedStorageItem(key);
    const storedValue = cached.found ? undefined : window.localStorage.getItem(key);
    if (!cached.found && storedValue === null) return fallback;

    const parsedValue: unknown = cached.found
      ? cached.value
      : JSON.parse(storedValue as string);
    if (isValid(parsedValue)) return parsedValue;

    console.warn(`Ignoring invalid localStorage value for "${key}".`);
  } catch (error) {
    console.error(`Could not read localStorage key "${key}".`, error);
  }

  return fallback;
}

export function writeStoredValue<T>(key: string, value: T): void {
  setCachedStorageItem(key, value);
}
