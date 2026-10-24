import { useEffect, useState } from 'react';
import { BookOpen, Camera, Plus, Save, Sparkles, Trash2, Users } from 'lucide-react';
import { compressChatPhoto } from '../utils/imageFile';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';

type Contact = { id: string; name: string };
type Book = { id: string; name: string; isGlobal?: boolean };
type Role = { contactId: string; identity: string; relationToUser: string };
type Relationship = { leftId: string; rightId: string; description: string };
export type ChannelSettings = {
  identity: string; avatarUrl: string; accountId: string; nickname: string; bio: string;
  platformSetting: string; prompt: string; roles: Role[]; relationships: Relationship[]; worldBookIds: string[];
};
type Preset = { id: string; name: string; settings: ChannelSettings };
type Store = { activePresetId: string; settings: ChannelSettings; presets: Preset[] };
type Props = { userName: string; avatarUrl?: string; contacts: Contact[] };
const STORAGE_KEY = 'yyphone:channels:profile-settings';
const emptySettings = (): ChannelSettings => ({ identity: '', avatarUrl: '', accountId: '', nickname: '', bio: '',
  platformSetting: '', prompt: '', roles: [], relationships: [], worldBookIds: [] });
const validSettings = (value: unknown): value is ChannelSettings => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return ['identity', 'avatarUrl', 'accountId', 'nickname', 'bio', 'platformSetting', 'prompt'].every(key => typeof item[key] === 'string') &&
    Array.isArray(item.roles) && item.roles.every(role => role && typeof role.contactId === 'string' && typeof role.identity === 'string' && typeof role.relationToUser === 'string') &&
    Array.isArray(item.relationships) && item.relationships.every(rel => rel && typeof rel.leftId === 'string' && typeof rel.rightId === 'string' && typeof rel.description === 'string') &&
    Array.isArray(item.worldBookIds) && item.worldBookIds.every(id => typeof id === 'string');
};
const validStore = (value: unknown): value is Store => !!value && typeof value === 'object' &&
  typeof (value as Store).activePresetId === 'string' && validSettings((value as Store).settings) &&
  Array.isArray((value as Store).presets) && (value as Store).presets.every(preset =>
    preset && typeof preset.id === 'string' && typeof preset.name === 'string' && validSettings(preset.settings));
const defaultStore = (): Store => ({ activePresetId: '', settings: emptySettings(), presets: [] });
const readBooks = (): Book[] => readStoredValue('yyphone:world-books', [] as Book[], (value): value is Book[] =>
  Array.isArray(value) && value.every(book => book && typeof book.id === 'string' && typeof book.name === 'string'));
const pairKey = (leftId: string, rightId: string) => [leftId, rightId].sort().join('\u0000');

export function ChannelsProfile({ userName, avatarUrl, contacts }: Props) {
  const [store, setStore] = useState(() => readStoredValue(STORAGE_KEY, defaultStore(), validStore));
  const [books, setBooks] = useState(readBooks);
  const [presetName, setPresetName] = useState('');
  const [message, setMessage] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  useEffect(() => { writeStoredValue(STORAGE_KEY, store); }, [store]);
  useEffect(() => { setBooks(readBooks()); }, []);
  const settings = store.settings;
  const update = (patch: Partial<ChannelSettings>) => setStore(previous => {
    const nextSettings = { ...previous.settings, ...patch };
    return {
      ...previous, settings: nextSettings,
      presets: previous.activePresetId ? previous.presets.map(preset => preset.id === previous.activePresetId
        ? { ...preset, settings: structuredClone(nextSettings) } : preset) : previous.presets,
    };
  });
  const activePreset = store.presets.find(preset => preset.id === store.activePresetId);
  const roleName = (id: string) => contacts.find(contact => contact.id === id)?.name ?? '已移除的角色';
  const rolePairs = settings.roles.flatMap((role, index) => settings.roles.slice(index + 1).map(other => ({
    leftId: role.contactId, rightId: other.contactId, key: pairKey(role.contactId, other.contactId),
  })));
  const saveNewPreset = () => {
    const name = presetName.trim();
    if (!name) { setMessage('请先填写预设名称。'); return; }
    const preset: Preset = { id: crypto.randomUUID(), name: name.slice(0, 40), settings: structuredClone(settings) };
    setStore(previous => ({ ...previous, activePresetId: preset.id, presets: [...previous.presets, preset] }));
    setPresetName(''); setMessage(`已保存预设「${preset.name}」。`);
  };
  const updatePreset = () => {
    if (!activePreset) return;
    const name = presetName.trim() || activePreset.name;
    setStore(previous => ({ ...previous, presets: previous.presets.map(preset => preset.id === previous.activePresetId
      ? { ...preset, name: name.slice(0, 40), settings: structuredClone(previous.settings) } : preset) }));
    setPresetName(''); setMessage(`已更新预设「${name}」。`);
  };
  const deletePreset = () => {
    if (!activePreset || !window.confirm(`删除预设「${activePreset.name}」？当前页面设置会保留。`)) return;
    setStore(previous => ({ ...previous, activePresetId: '', presets: previous.presets.filter(preset => preset.id !== previous.activePresetId) }));
    setMessage('预设已删除，当前设置仍在。');
  };
  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    setAvatarBusy(true); setMessage('');
    try { update({ avatarUrl: await compressChatPhoto(file) }); }
    catch (error) { setMessage(error instanceof Error ? error.message : '头像上传失败。'); }
    finally { setAvatarBusy(false); }
  };
  const field = (label: string, value: string, onChange: (value: string) => void, placeholder: string, maxLength = 120) =>
    <label className="block text-xs font-medium text-slate-600">{label}<input value={value} maxLength={maxLength} onChange={event => onChange(event.target.value)} placeholder={placeholder}
      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-400" /></label>;
  const textarea = (label: string, value: string, onChange: (value: string) => void, placeholder: string, maxLength: number) =>
    <label className="block text-xs font-medium text-slate-600">{label}<textarea value={value} maxLength={maxLength} onChange={event => onChange(event.target.value)} placeholder={placeholder}
      className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none focus:border-emerald-400" /></label>;
  return <div className="min-h-full bg-[#f4f7f5] pb-6">
    <div className="relative overflow-hidden bg-gradient-to-br from-[#164c42] via-[#277567] to-[#89bba8] px-5 pb-7 pt-7 text-white">
      <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full border border-white/20"/><div className="absolute -right-4 -top-8 h-32 w-32 rounded-full border border-white/20"/>
      <p className="text-[11px] font-semibold tracking-[0.22em] text-white/70">CHANNEL PROFILE</p>
      <div className="relative mt-5 flex items-center gap-4">
        <label className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-white/60 bg-white/20 text-2xl font-bold shadow-lg">
          {settings.avatarUrl || avatarUrl ? <img src={settings.avatarUrl || avatarUrl} alt="视频号头像" className="h-full w-full object-cover"/> : (settings.nickname || userName).charAt(0) || '我'}
          <span className="absolute bottom-0 right-0 rounded-tl-lg bg-black/45 p-1"><Camera className="h-3.5 w-3.5"/></span>
          <input type="file" accept="image/*" className="hidden" disabled={avatarBusy} onChange={event => { void uploadAvatar(event.target.files?.[0]); event.currentTarget.value = ''; }}/>
        </label>
        <div className="min-w-0"><p className="truncate text-xl font-bold">{settings.nickname || userName || '未设置昵称'}</p><p className="mt-1 text-xs text-white/75">@{settings.accountId || '设置视频号 ID'}</p><span className="mt-2 inline-block rounded-full bg-white/20 px-2.5 py-1 text-[10px]">{settings.identity || '设置你的平台身份'}</span></div>
      </div>
      <p className="relative mt-4 text-xs leading-5 text-white/80">{settings.bio || '写一句签名，让这个视频号有自己的气质。'}</p>
    </div>
    <div className="-mt-3 space-y-4 px-3">
      <section className="relative rounded-2xl bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-600"/><h2 className="text-sm font-bold">我的视频号身份</h2></div>
        <div className="space-y-3">
          {field('平台身份', settings.identity, identity => update({ identity }), '素人、网红、博主、主播……', 60)}
          {field('昵称', settings.nickname, nickname => update({ nickname }), userName || '视频号昵称', 40)}
          {field('视频号 ID', settings.accountId, accountId => update({ accountId }), '自定义 ID', 40)}
          {field('头像链接', settings.avatarUrl, avatarUrl => update({ avatarUrl }), '也可以点击上方头像上传', 1000)}
          {textarea('签名', settings.bio, bio => update({ bio }), '介绍一下你在这里的样子', 300)}
        </div>
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="mb-4 text-sm font-bold">平台与生成设定</h2><div className="space-y-3">
        {textarea('平台设定', settings.platformSetting, platformSetting => update({ platformSetting }), '这是一个怎样的视频号平台？氛围、内容类型、规则和世界观……', 5000)}
        {textarea('视频号专用提示词', settings.prompt, prompt => update({ prompt }), '只用于未来的视频号内容与直播生成，不影响微信聊天', 10000)}
      </div></section>
      <section className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600"/><h2 className="text-sm font-bold">关联角色</h2></div><p className="mb-3 text-[11px] text-slate-500">分别设定角色在平台的身份，以及与玩家和其他角色的关系。</p>
        <div className="space-y-2">{contacts.map(contact => {
          const role = settings.roles.find(item => item.contactId === contact.id);
          return <div key={contact.id} className="rounded-xl border border-slate-100 p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!role} onChange={event => update({ roles: event.target.checked ? [...settings.roles, { contactId: contact.id, identity: '', relationToUser: '' }] : settings.roles.filter(item => item.contactId !== contact.id), relationships: event.target.checked ? settings.relationships : settings.relationships.filter(item => item.leftId !== contact.id && item.rightId !== contact.id) })}/>{contact.name}</label>
            {role && <div className="mt-3 grid gap-3">{field('角色在平台的身份', role.identity, identity => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, identity } : item) }), '例如：主播、粉丝、创作者、路人', 120)}{field('与玩家的关系', role.relationToUser, relationToUser => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, relationToUser } : item) }), '他们在视频号里如何认识、互动？', 300)}</div>}
          </div>;
        })}</div>
        {!contacts.length && <p className="text-xs text-slate-400">通讯录暂无角色。</p>}
        {!!rolePairs.length && <div className="mt-4 border-t border-slate-100 pt-4"><h3 className="mb-3 text-xs font-bold">角色彼此的关系</h3><div className="space-y-3">{rolePairs.map(pair => {
          const relation = settings.relationships.find(item => pairKey(item.leftId, item.rightId) === pair.key);
          return <div key={pair.key}>{field(`${roleName(pair.leftId)} × ${roleName(pair.rightId)}`, relation?.description ?? '', description => update({ relationships: [...settings.relationships.filter(item => pairKey(item.leftId, item.rightId) !== pair.key), { leftId: pair.leftId, rightId: pair.rightId, description }] }), '他们在这个平台上的关系', 300)}</div>;
        })}</div></div>}
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-2 flex items-center gap-2"><BookOpen className="h-4 w-4 text-emerald-600"/><h2 className="text-sm font-bold">关联世界书</h2></div><p className="mb-3 text-[11px] text-slate-500">选择视频号专用的世界书；下次生成内容时可按此配置读取。</p>
        {books.length ? <div className="space-y-2">{books.map(book => <label key={book.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><input type="checkbox" checked={settings.worldBookIds.includes(book.id)} onChange={event => update({ worldBookIds: event.target.checked ? [...settings.worldBookIds, book.id] : settings.worldBookIds.filter(id => id !== book.id) })}/><span>{book.name}</span>{book.isGlobal && <span className="text-slate-400">全局</span>}</label>)}</div> : <p className="text-xs text-slate-400">暂无世界书，可先到世界书应用创建。</p>}
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-sm"><div className="mb-2 flex items-center gap-2"><Save className="h-4 w-4 text-emerald-600"/><h2 className="text-sm font-bold">设定预设</h2></div><p className="mb-3 text-[11px] text-slate-500">编辑会自动保存到当前预设；“更新当前预设”也可用于重命名。</p>
        <select aria-label="切换视频号预设" value={store.activePresetId} onChange={event => {
          const preset = store.presets.find(item => item.id === event.target.value);
          if (preset) { setStore(previous => ({ ...previous, activePresetId: preset.id, settings: structuredClone(preset.settings) })); setMessage(`已切换到「${preset.name}」。`); }
          else { setStore(previous => ({ ...previous, activePresetId: '' })); setMessage('已取消预设关联，当前设置保留。'); }
        }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">当前设置（未关联预设）</option>{store.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>
        <div className="mt-3 flex gap-2"><input aria-label="视频号预设名称" value={presetName} maxLength={40} onChange={event => setPresetName(event.target.value)} placeholder={activePreset ? `更新或重命名「${activePreset.name}」` : '新预设名称'} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"/><button type="button" onClick={saveNewPreset} className="flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5"/>新增</button></div>
        {activePreset && <div className="mt-3 flex gap-2"><button type="button" onClick={updatePreset} className="flex-1 rounded-xl bg-emerald-50 py-2 text-xs font-bold text-emerald-800">更新当前预设</button><button type="button" onClick={deletePreset} className="flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"><Trash2 className="h-3.5 w-3.5"/>删除</button></div>}
        {message && <p role="status" className="mt-3 text-xs text-emerald-700">{message}</p>}
      </section>
    </div>
  </div>;
}
