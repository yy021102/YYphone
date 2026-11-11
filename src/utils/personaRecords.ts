import type { PersonaCollection } from '../types';
import { activePersonaRecordSpace, setStorageItemsAtomically } from './dbStorage';
import { readStoredValue } from './localStorage';
import { PERSONA_COLLECTION_KEY, PERSONA_RECORDS_KEY, parsePersonaRecordSpaces, personaStorageKey } from './personaStorage';

export const readPersonaRecordSpaces = () => { const value = parsePersonaRecordSpaces(readStoredValue<unknown>(PERSONA_RECORDS_KEY, null, (_value): _value is unknown => true)); return { ...value, profiles: { ...value.profiles } }; };
export function personaHasRecords(profileId: string): boolean {
  return Object.hasOwn(readPersonaRecordSpaces().profiles, profileId);
}
export async function switchPersonaRecords(collection: PersonaCollection, mode?: 'shared' | 'independent', previousProfileId?: string): Promise<{ reload: boolean }> {
  if (!collection.profiles.some(profile => profile.id === collection.activeProfileId)) throw new Error('要切换的人设不存在。');
  const current = readStoredValue<PersonaCollection | null>(PERSONA_COLLECTION_KEY, null, (value): value is PersonaCollection | null => value === null || !!value && typeof value === 'object' && 'activeProfileId' in value);
  const spaces = readPersonaRecordSpaces(), from = activePersonaRecordSpace();
  const targetId = collection.activeProfileId;
  const previousId = current?.activeProfileId ?? previousProfileId;
  if (previousId && !Object.hasOwn(spaces.profiles, previousId)) spaces.profiles[previousId] = from;
  let target = Object.hasOwn(spaces.profiles, targetId) ? spaces.profiles[targetId] : undefined;
  if (!target) {
    if (!mode) throw new Error('请选择沿用当前记录，或开启独立记录。');
    target = mode === 'shared' ? from : `space-${crypto.randomUUID()}`;
    spaces.profiles[targetId] = target;
  }
  const changes: Record<string, unknown> = { [PERSONA_RECORDS_KEY]: spaces, [PERSONA_COLLECTION_KEY]: collection };
  if (mode === 'independent' && target !== from) {
    // Reuse editable character cards, never carry conversations, relationship state or memories.
    for (const key of ['pocketos:wechat-contacts', 'yyphone:character-npcs']) {
      changes[personaStorageKey(key, target)] = readStoredValue<unknown[]>(key, [], (value): value is unknown[] => Array.isArray(value));
    }
  }
  await setStorageItemsAtomically(changes);
  return { reload: target !== from };
}
