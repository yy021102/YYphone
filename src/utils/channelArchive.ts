import { isChannelData, record, type ChannelData, type ChannelKind } from './channelLife';
import { isChannelProfile, type ChannelProfileStore } from './channelProfile';

export type ChannelArchive = { format: 'yyphone-channels'; version: 1; exportedAt: string; data: ChannelData; profile: ChannelProfileStore };
/** Keep ongoing streams and only the latest three ended streams, ordered by their end time. */
export function trimChannelReplays(data: ChannelData): ChannelData {
  const ended = data.rooms.filter(room => room.ended).sort((a, b) => (b.endedAt ?? b.time) - (a.endedAt ?? a.time));
  if (ended.length <= 3) return data;
  const keep = new Set(ended.slice(0, 3).map(room => room.id));
  return { ...data, rooms: data.rooms.filter(room => !room.ended || keep.has(room.id)) };
}
export function clearChannelSection(data: ChannelData, kind: ChannelKind): ChannelData {
  if (kind === 'posts') return { ...data, posts: [], saved: [], messages: data.messages.map(({ sourcePostId: _, ...thread }) => thread) };
  return { ...data, [kind]: [] };
}
export function createChannelArchive(data: ChannelData, profile: ChannelProfileStore): ChannelArchive {
  return structuredClone({ format: 'yyphone-channels', version: 1, exportedAt: new Date().toISOString(), data: trimChannelReplays(data), profile });
}
export function parseChannelArchive(value: unknown): ChannelArchive {
  if (!record(value) || value.format !== 'yyphone-channels' || value.version !== 1 || typeof value.exportedAt !== 'string' ||
    !isChannelData(value.data) || !isChannelProfile(value.profile)) throw new Error('文件不是有效的视频号备份。');
  const ids = [...value.data.posts, ...value.data.rooms, ...value.data.messages].map(item => item.id);
  if (ids.some(id => !id.trim()) || new Set(ids).size !== ids.length) throw new Error('备份中的内容编号重复或缺失。');
  const presetIds = value.profile.presets.map(preset => preset.id);
  if (new Set(presetIds).size !== presetIds.length || value.profile.activePresetId && !presetIds.includes(value.profile.activePresetId)) throw new Error('备份中的预设关联无效。');
  return structuredClone({ ...value, data: trimChannelReplays(value.data) }) as ChannelArchive;
}
