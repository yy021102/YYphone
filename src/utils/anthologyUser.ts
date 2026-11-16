import { readStoredValue } from './localStorage';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';

/** Read only the active persona; photo references and inactive identities never enter writing requests. */
export function readAnthologyUser() {
  const collection = readStoredValue('pocketos:personas', null, record);
  const active = collection && Array.isArray(collection.profiles)
    ? collection.profiles.find(p => record(p) && p.id === collection.activeProfileId) : undefined;
  const profile = record(active) ? active : {};
  const wechat = readStoredValue('yyphone:wechat-profile', null, record);
  const desktop = readStoredValue('pocketos:user-profile', null, record);
  const label = text(profile.name);
  const name = text(profile.realName) || text(profile.nickname) || (!['默认人设', '未命名人设'].includes(label) ? label : '') || text(wechat?.name) || text(desktop?.name) || '我';
  return {
    id: text(profile.id), name, avatarUrl: text(profile.avatarUrl) || text(wechat?.avatarUrl) || text(desktop?.avatarUrl),
    identity: text(profile.identity), personality: text(profile.personality), background: text(profile.background), speakingStyle: text(profile.speakingStyle),
  };
}
