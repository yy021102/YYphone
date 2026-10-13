export function readStoredValue<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T
): T {
  try {
    const storedValue = window.localStorage.getItem(key);
    if (storedValue === null) return fallback;

    const parsedValue: unknown = JSON.parse(storedValue);
    if (isValid(parsedValue)) return parsedValue;

    console.warn(`Ignoring invalid localStorage value for "${key}".`);
  } catch (error) {
    console.error(`Could not read localStorage key "${key}".`, error);
  }

  return fallback;
}

export function writeStoredValue<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}
