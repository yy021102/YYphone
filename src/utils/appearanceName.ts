/** Compare saved styles independently of JSON property order. */
export function sameAppearance(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  return canonical(a) === canonical(b);
}

export function appearanceFilename(prefix: string, name?: string): string {
  const safeName = name?.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 80);
  return `${prefix}${safeName ? `-${safeName}` : ''}.json`;
}
