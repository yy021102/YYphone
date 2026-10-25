import { record, type ChannelPerson } from './channelLife';

export type ChannelRole = { contactId: string; identity: string; relationToUser: string; nickname?: string; accountId?: string;
  persona?: string; audienceAttitude?: string; followerCount?: number; injectChatContext?: boolean; injectMemory?: boolean;
  sharePrivateMemory?: boolean; shareLiveMemory?: boolean };
export type ChannelSettings = { identity: string; avatarUrl: string; accountId: string; nickname: string; bio: string;
  platformSetting: string; prompt: string; roles: ChannelRole[];
  relationships: { leftId: string; rightId: string; description: string }[]; worldBookIds: string[];
  persona?: string; audienceAttitude?: string; followingCount?: number; followerCount?: number };
export type ChannelProfileStore = { activePresetId: string; settings: ChannelSettings;
  presets: { id: string; name: string; settings: ChannelSettings }[] };
export const CHANNEL_PROFILE_KEY = 'yyphone:channels:profile-settings';
export const emptyChannelSettings = (): ChannelSettings => ({ identity: '', avatarUrl: '', accountId: '', nickname: '', bio: '',
  platformSetting: '', prompt: '', roles: [], relationships: [], worldBookIds: [] });
export const emptyChannelProfile = (): ChannelProfileStore => ({ activePresetId: '', settings: emptyChannelSettings(), presets: [] });
export const isChannelCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1000000000;
export function isChannelSettings(value: unknown): value is ChannelSettings {
  return record(value) && ['identity', 'avatarUrl', 'accountId', 'nickname', 'bio', 'platformSetting', 'prompt'].every(key => typeof value[key] === 'string') &&
    ['persona', 'audienceAttitude'].every(key => value[key] === undefined || typeof value[key] === 'string') &&
    ['followingCount', 'followerCount'].every(key => value[key] === undefined || isChannelCount(value[key])) &&
    Array.isArray(value.roles) && value.roles.every(role => record(role) && ['contactId', 'identity', 'relationToUser'].every(key => typeof role[key] === 'string') &&
      ['nickname', 'accountId', 'persona', 'audienceAttitude'].every(key => role[key] === undefined || typeof role[key] === 'string') &&
      (role.followerCount === undefined || isChannelCount(role.followerCount)) &&
      ['sharePrivateMemory', 'shareLiveMemory', 'injectChatContext', 'injectMemory'].every(key => role[key] === undefined || typeof role[key] === 'boolean')) &&
    Array.isArray(value.relationships) && value.relationships.every(rel => record(rel) && ['leftId', 'rightId', 'description'].every(key => typeof rel[key] === 'string')) &&
    Array.isArray(value.worldBookIds) && value.worldBookIds.every(id => typeof id === 'string');
}
export function channelPlatformPublicContext(settings: ChannelSettings, contacts: ChannelPerson[]) {
  return settings.roles.flatMap(role => {
    const contact = contacts.find(person => person.id === role.contactId);
    if (!contact) return [];
    const person = channelPerson(contact, settings);
    return [{ id: person.id, name: person.name, accountId: person.accountId, persona: (role.persona ?? role.identity).slice(0, 5000),
      audienceAttitude: role.audienceAttitude?.slice(0, 1500) || '', ...(role.followerCount !== undefined ? { followerCount: role.followerCount } : {}) }];
  });
}
export function isChannelProfile(value: unknown): value is ChannelProfileStore {
  return record(value) && typeof value.activePresetId === 'string' && isChannelSettings(value.settings) && Array.isArray(value.presets) &&
    value.presets.every(preset => record(preset) && typeof preset.id === 'string' && typeof preset.name === 'string' && isChannelSettings(preset.settings));
}
/** Platform identity never replaces the contact ID used for chats, invitations or memory. */
export function channelPerson(person: ChannelPerson, settings?: ChannelSettings): ChannelPerson {
  const role = settings?.roles.find(role => role.contactId === person.id);
  return { ...person, name: role?.nickname?.trim() || person.forumNickname?.trim() || person.name,
    accountId: (role?.accountId?.trim() || person.forumHandle?.trim() || person.accountId?.trim() || '').replace(/^@/, '') };
}
