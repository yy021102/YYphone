export const PERSONA_RECORDS_KEY = 'yyphone:persona-record-spaces';
export const PERSONA_COLLECTION_KEY = 'pocketos:personas';
const PREFIX = 'yyphone:persona-record:';
// Device preferences and creative libraries remain shared; life and relationship data do not.
const SHARED = new Set([
  PERSONA_RECORDS_KEY, PERSONA_COLLECTION_KEY, 'pocketos:user-profile',
  'yyphone:world-books', 'yyphone:character-npcs-library', 'yyphone:memory-settings',
  'yyphone:api-presets', 'yyphone:active-api-preset', 'yyphone:voice-model', 'yyphone:image-generation',
  'yyphone:image-generation-presets', 'yyphone:active-image-generation-preset', 'yyphone:mcp-settings',
  'yyphone:image-prompt-presets',
  'yyphone:offline-api', 'yyphone:game-api', 'yyphone:offline-presets', 'yyphone:offline-style',
  'yyphone:beauty-settings', 'yyphone:beauty-presets', 'yyphone:font-settings', 'yyphone:font-presets', 'yyphone:chat-runtime',
  'yyphone:lock-settings', 'yyphone:show-status-bar', 'yyphone:follow-system-dark',
  'yyphone:opening-animation', 'yyphone:opening-style', 'yyphone:chat-appearance', 'yyphone:chat-regex',
  'yyphone:chat-stickers', 'yyphone:chat-sticker-categories', 'yyphone:chat-context-presets',
  'yyphone:calendar-appearance', 'yyphone:music-appearance', 'yyphone:birthday-settings',
  'yyphone:little-p-visible', 'yyphone:little-p-position',
  'yyphone:backup-date-naming',
]);
export function isPersonaRecordKey(key: string): boolean {
  if (key.startsWith(PREFIX) || SHARED.has(key)) return false;
  if (/^yyphone:(?:first-use|access-|github-|cloud-|halloween-|.*-config-expanded)/.test(key)) return false;
  return key.startsWith('yyphone:') || key === 'pocketos:wechat-contacts';
}
export function personaStorageKey(key: string, space: string): string {
  return space === 'legacy' || !isPersonaRecordKey(key) ? key : `${PREFIX}${encodeURIComponent(space)}:${encodeURIComponent(key)}`;
}
export interface PersonaRecordSpaces { version: 1; profiles: Record<string, string> }
export function parsePersonaRecordSpaces(value: unknown): PersonaRecordSpaces {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('profiles' in value) || !value.profiles || typeof value.profiles !== 'object' || Array.isArray(value.profiles) ||
    !Object.entries(value.profiles).every(([id, space]) => !!id && typeof space === 'string' && !!space && space.length <= 200)) {
    return { version: 1, profiles: {} };
  }
  return value as PersonaRecordSpaces;
}
