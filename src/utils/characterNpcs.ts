import { readStorageString, writeStorageString } from './localStorage';

export const CHARACTER_NPCS_STORAGE_KEY = 'yyphone:character-npcs';

export interface CharacterNpc {
  id: string;
  name: string;
  avatarUrl: string;
  persona: string;
  linkedCharIds: string[];
  charId?: string;
  charName?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const normalizeNpc = (value: unknown, ownerId?: string): CharacterNpc | undefined => {
  if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim()) return undefined;
  const linkedCharIds = Array.isArray(value.linkedCharIds)
    ? value.linkedCharIds.filter((id): id is string => typeof id === 'string')
    : [];
  const legacyCharId = typeof value.charId === 'string'
    ? value.charId
    : typeof value.ownerId === 'string'
      ? value.ownerId
      : ownerId;
  if (legacyCharId && !linkedCharIds.includes(legacyCharId)) linkedCharIds.push(legacyCharId);
  if (!linkedCharIds.length) return undefined;
  return {
    id: typeof value.id === 'string' && value.id
      ? value.id
      : `npc-${linkedCharIds[0]}-${value.name.trim()}`,
    name: value.name.trim(),
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : '',
    persona: typeof value.persona === 'string' ? value.persona : '',
    linkedCharIds: [...new Set(linkedCharIds)],
    ...(legacyCharId ? { charId: legacyCharId } : {}),
    ...(typeof value.charName === 'string' ? { charName: value.charName } : {}),
  };
};

export function readCharacterNpcs(): CharacterNpc[] {
  try {
    const raw = readStorageString(CHARACTER_NPCS_STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    const candidates: CharacterNpc[] = [];
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        const npc = normalizeNpc(item);
        if (npc) candidates.push(npc);
      });
    } else if (isRecord(parsed)) {
      Object.entries(parsed).forEach(([ownerId, items]) => {
        if (!Array.isArray(items)) return;
        items.forEach((item) => {
          const npc = normalizeNpc(item, ownerId);
          if (npc) candidates.push(npc);
        });
      });
    } else {
      console.warn(`Ignoring invalid localStorage value for "${CHARACTER_NPCS_STORAGE_KEY}".`);
    }
    try {
      const legacyContactsRaw = readStorageString('pocketos:wechat-contacts');
      if (legacyContactsRaw) {
        const legacyContacts: unknown = JSON.parse(legacyContactsRaw);
        if (Array.isArray(legacyContacts)) {
          legacyContacts.forEach((contact) => {
            if (!isRecord(contact) || typeof contact.id !== 'string') return;
            const ownerId = contact.id;
            const legacyNpcs = contact.npcs ?? contact.npcList;
            if (!Array.isArray(legacyNpcs)) return;
            legacyNpcs.forEach((item) => {
              const npc = normalizeNpc(item, ownerId);
              if (npc) candidates.push(npc);
            });
          });
        }
      }
    } catch (error) {
      console.error('Could not migrate NPCs embedded in legacy contacts.', error);
    }
    const merged = new Map<string, CharacterNpc>();
    candidates.forEach((npc) => {
      const existing = merged.get(npc.id);
      merged.set(npc.id, existing
        ? { ...existing, linkedCharIds: [...new Set([...existing.linkedCharIds, ...npc.linkedCharIds])] }
        : npc);
    });
    return [...merged.values()];
  } catch (error) {
    console.error('Could not read shared character NPCs.', error);
    return [];
  }
}

export function writeCharacterNpcs(npcs: CharacterNpc[], contacts: Array<{ id: string; name: string }>) {
  const normalized = [...new Map(npcs.map((npc) => [npc.id, npc])).values()]
    .map((npc) => {
      const linkedCharIds = [...new Set(npc.linkedCharIds)];
      const primary = contacts.find((contact) => linkedCharIds.includes(contact.id));
      return {
        ...npc,
        linkedCharIds,
        ...(primary ? { charId: primary.id, charName: primary.name } : {}),
      };
    });
  writeStorageString(CHARACTER_NPCS_STORAGE_KEY, JSON.stringify(normalized));
}

export const npcParticipantId = (npcId: string) => `npc:${npcId}`;

export const getNpcByParticipantId = (npcs: CharacterNpc[], participantId: string) =>
  participantId.startsWith('npc:')
    ? npcs.find((npc) => npc.id === participantId.slice(4))
    : undefined;
