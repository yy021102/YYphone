import { useEffect, useRef, useState } from 'react';
import { BookOpen, Camera, Plus, Save, Sparkles, Trash2, Users, ChevronDown, Download, Upload, Database } from 'lucide-react';
import { compressChatPhoto } from '../utils/imageFile';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { CHANNEL_PROFILE_KEY, emptyChannelProfile, isChannelProfile, isChannelCount, channelPerson, type ChannelProfileStore, type ChannelSettings } from '../utils/channelProfile';
import { formatChannelCount } from '../utils/channelEngagement';
import { parseChannelArchive, type ChannelArchive } from '../utils/channelArchive';
import type { ChannelKind, ChannelPerson } from '../utils/channelLife';

type Contact = ChannelPerson;
type Book = { id: string; name: string; isGlobal?: boolean };
type Preset = ChannelProfileStore['presets'][number];
type Store = ChannelProfileStore;
export type { ChannelSettings } from '../utils/channelProfile';
type Props = { userName: string; avatarUrl?: string; contacts: Contact[];
  stats?: { posts: number; rooms: number; saved: number; following: number };
  onView?: (destination: 'posts' | 'rooms' | 'saved' | 'following') => void;
  dataBusy?: boolean; onExport: (profile: ChannelProfileStore) => void;
  onImport: (archive: ChannelArchive) => Promise<void>; onClear: (kind: ChannelKind) => boolean;
};
const STORAGE_KEY = CHANNEL_PROFILE_KEY;
const defaultStore = emptyChannelProfile;
const validStore = isChannelProfile;
const readBooks = (): Book[] => readStoredValue('yyphone:world-books', [] as Book[], (value): value is Book[] =>
  Array.isArray(value) && value.every(book => book && typeof book.id === 'string' && typeof book.name === 'string'));
const pairKey = (leftId: string, rightId: string) => [leftId, rightId].sort().join('\u0000');

export function ChannelsProfile({ userName, avatarUrl, contacts, stats, onView, dataBusy, onExport, onImport, onClear }: Props) {
  const [store, setStore] = useState(() => readStoredValue(STORAGE_KEY, defaultStore(), validStore));
  const [books, setBooks] = useState(readBooks);
  const [presetName, setPresetName] = useState('');
  const [message, setMessage] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => { try { writeStoredValue(STORAGE_KEY, store); } catch { setMessage('设定保存失败，请检查本地存储后重试。'); } }, [store]);
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
  const importArchive = async (file?: File) => {
    if (!file || dataBusy || importBusy || avatarBusy) return;
    setImportBusy(true); setMessage('');
    try {
      const archive = parseChannelArchive(JSON.parse(await file.text()));
      if (!window.confirm('导入将替换当前视频号的全部内容和设置，是否继续？')) return;
      await onImport(archive);
      setStore(archive.profile); setPresetName(''); setMessage('已导入');
    } catch (error) { setMessage(error instanceof Error ? error.message : '导入失败'); }
    finally { setImportBusy(false); }
  };
  const field = (label: string, value: string, onChange: (value: string) => void, placeholder: string, maxLength = 120) =>
    <label className="block text-xs font-medium text-slate-600">{label}<input value={value} maxLength={maxLength} onChange={event => onChange(event.target.value)} placeholder={placeholder}
      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-400" /></label>;
  const textarea = (label: string, value: string, onChange: (value: string) => void, placeholder: string, maxLength: number) =>
    <label className="block text-xs font-medium text-slate-600">{label}<textarea value={value} maxLength={maxLength} onChange={event => onChange(event.target.value)} placeholder={placeholder}
      className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none focus:border-emerald-400" /></label>;
  const countField = (label: string, value: number | undefined, change: (value: number | undefined) => void, placeholder = '0') => <label className="channel-count-field">{label}<input aria-label={label} type="number" inputMode="numeric" min={0} max={1000000000} step={1} value={value ?? ''} placeholder={placeholder} onChange={event => {
    const raw = event.target.value; if (!raw) change(undefined); else if (isChannelCount(Number(raw))) change(Number(raw));
  }} /></label>;
  return <fieldset disabled={dataBusy || importBusy} className="channels-profile min-h-full min-w-0 pb-6">
    <div className="channel-profile-hero relative overflow-hidden px-5 pb-7 pt-[calc(env(safe-area-inset-top,0px)+28px)]">
      <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full border border-white/20"/><div className="absolute -right-4 -top-8 h-32 w-32 rounded-full border border-white/20"/>
      <div className="relative mt-5 flex items-center gap-4">
        <label className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-white/60 bg-white/40 text-2xl font-bold text-[#789a88] shadow-sm">
          {settings.avatarUrl || avatarUrl ? <img src={settings.avatarUrl || avatarUrl} alt="视频号头像" className="h-full w-full object-cover"/> : (settings.nickname || userName).charAt(0) || '我'}
          <span className="absolute bottom-0 right-0 rounded-tl-lg bg-black/45 p-1"><Camera className="h-3.5 w-3.5"/></span>
          <input type="file" accept="image/*" className="hidden" disabled={avatarBusy} onChange={event => { void uploadAvatar(event.target.files?.[0]); event.currentTarget.value = ''; }}/>
        </label>
        <div className="min-w-0"><p className="truncate text-xl font-bold">{settings.nickname || userName || '未设置昵称'}</p><p className="mt-1 text-xs opacity-60">@{settings.accountId || '设置视频号 ID'}</p><span className="mt-2 inline-block rounded-full bg-white/50 px-2.5 py-1 text-[10px]">{settings.identity || '设置你的平台身份'}</span></div>
      </div>
      {settings.bio && <p className="relative mt-4 text-xs leading-5 opacity-70">{settings.bio}</p>}
      <div className="channel-account-counts"><span><strong>{formatChannelCount(settings.followingCount ?? stats?.following ?? 0)}</strong>关注</span><span><strong>{formatChannelCount(settings.followerCount ?? 0)}</strong>粉丝</span></div>
    </div>
    <div className="-mt-3 space-y-4 px-3">
      {stats && <div className="channel-profile-stats">{([['posts', '我的动态'], ['rooms', '我的直播'], ['saved', '我的收藏'], ['following', '关注动态']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => onView?.(key)}><strong>{stats[key]}</strong><span>{label}</span></button>)}</div>}
      <section className="relative rounded-2xl bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-600"/><h2 className="text-sm font-bold">我的视频号</h2></div>
        <div className="space-y-3">
          {field('平台身份', settings.identity, identity => update({ identity }), '素人、网红、博主、主播……', 60)}
          {textarea('我的平台人设', settings.persona || '', persona => update({ persona }), '', 5000)}
          {textarea('我的路人印象', settings.audienceAttitude || '', audienceAttitude => update({ audienceAttitude }), '', 1500)}
          <div className="channel-count-fields">{countField('关注数', settings.followingCount, followingCount => update({ followingCount }))}{countField('粉丝数', settings.followerCount, followerCount => update({ followerCount }))}</div>
          {field('昵称', settings.nickname, nickname => update({ nickname }), userName || '视频号昵称', 40)}
          {field('视频号 ID', settings.accountId, accountId => update({ accountId }), '自定义 ID', 40)}
          {field('头像链接', settings.avatarUrl, avatarUrl => update({ avatarUrl }), '也可以点击上方头像上传', 1000)}
          {textarea('签名', settings.bio, bio => update({ bio }), '介绍一下你在这里的样子', 300)}
        </div>
      </section>
      <details className="channel-profile-settings rounded-2xl bg-white p-4 shadow-sm"><summary><span>平台与生成设定</span><ChevronDown size={14} /></summary><div className="mt-4 space-y-3">
        {textarea('平台设定', settings.platformSetting, platformSetting => update({ platformSetting }), '这是一个怎样的视频号平台？氛围、内容类型、规则和世界观……', 5000)}
        {textarea('视频号专用提示词', settings.prompt, prompt => update({ prompt }), '只用于未来的视频号内容与直播生成，不影响微信聊天', 10000)}
      </div></details>
      <details className="channel-profile-settings rounded-2xl bg-white p-4 shadow-sm"><summary><Users size={15} /><span>关联角色</span><small>{settings.roles.length} 位</small><ChevronDown size={14} /></summary><p className="mb-3 mt-4 text-[11px] text-slate-500">平台人设、路人印象与角色关系。</p>
        <div className="space-y-2">{contacts.map(contact => {
          const role = settings.roles.find(item => item.contactId === contact.id);
          return <div key={contact.id} className="rounded-xl border border-slate-100 p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!role} onChange={event => update({ roles: event.target.checked ? [...settings.roles, { contactId: contact.id, identity: '', relationToUser: '' }] : settings.roles.filter(item => item.contactId !== contact.id), relationships: event.target.checked ? settings.relationships : settings.relationships.filter(item => item.leftId !== contact.id && item.rightId !== contact.id) })}/>{contact.name}</label>
            {role && <div className="mt-3 grid gap-3">
              {field(`${contact.name}的视频号网名`, role.nickname || '', nickname => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, nickname } : item) }), channelPerson(contact).name, 40)}
              {field(`${contact.name}的视频号 ID`, role.accountId || '', accountId => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, accountId } : item) }), channelPerson(contact).accountId || '沿用角色设置', 40)}
              {textarea('平台人设', role.persona ?? role.identity, persona => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, persona } : item) }), '', 5000)}
              {textarea('路人印象', role.audienceAttitude || '', audienceAttitude => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, audienceAttitude } : item) }), '', 1500)}
              {countField(`${contact.name}的粉丝数`, role.followerCount, followerCount => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, followerCount } : item) }), '根据人设')}
              {field('与玩家的关系', role.relationToUser, relationToUser => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, relationToUser } : item) }), '', 300)}
              <div className="channel-memory-options">
                <label><input type="checkbox" aria-label={`${contact.name}注入聊天上下文`} checked={role.injectChatContext === true} onChange={event => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, injectChatContext: event.target.checked } : item) })} /><span>注入聊天上下文</span></label>
                <label><input type="checkbox" aria-label={`${contact.name}注入角色记忆`} checked={role.injectMemory === true} onChange={event => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, injectMemory: event.target.checked } : item) })} /><span>注入角色记忆</span></label>
                <p className="channel-help">私有内容仅供该角色参考。</p>
                <label><input type="checkbox" aria-label={`${contact.name}共享私信记忆`} checked={role.sharePrivateMemory === true} onChange={event => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, sharePrivateMemory: event.target.checked } : item) })} /><span>同步私信记忆<small>微信聊天可读取该角色的视频号私信。</small></span></label>
                <label><input type="checkbox" aria-label={`${contact.name}共享直播互动记忆`} checked={role.shareLiveMemory === true} onChange={event => update({ roles: settings.roles.map(item => item.contactId === contact.id ? { ...item, shareLiveMemory: event.target.checked } : item) })} /><span>共享直播互动记忆<small>微信和私信中可记得自己观看、参与过的直播。</small></span></label></div>
            </div>}
          </div>;
        })}</div>
        {!contacts.length && <p className="text-xs text-slate-400">通讯录暂无角色。</p>}
        {!!rolePairs.length && <div className="mt-4 border-t border-slate-100 pt-4"><h3 className="mb-3 text-xs font-bold">角色彼此的关系</h3><div className="space-y-3">{rolePairs.map(pair => {
          const relation = settings.relationships.find(item => pairKey(item.leftId, item.rightId) === pair.key);
          return <div key={pair.key}>{field(`${roleName(pair.leftId)} × ${roleName(pair.rightId)}`, relation?.description ?? '', description => update({ relationships: [...settings.relationships.filter(item => pairKey(item.leftId, item.rightId) !== pair.key), { leftId: pair.leftId, rightId: pair.rightId, description }] }), '他们在这个平台上的关系', 300)}</div>;
        })}</div></div>}
      </details>
      <details className="channel-profile-settings rounded-2xl bg-white p-4 shadow-sm"><summary><BookOpen size={15} /><span>关联世界书</span><small>{settings.worldBookIds.length} 本</small><ChevronDown size={14} /></summary><p className="mb-3 mt-4 text-[11px] text-slate-500">选择视频号专用的世界书；下次生成内容时可按此配置读取。</p>
        {books.length ? <div className="space-y-2">{books.map(book => <label key={book.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><input type="checkbox" checked={settings.worldBookIds.includes(book.id)} onChange={event => update({ worldBookIds: event.target.checked ? [...settings.worldBookIds, book.id] : settings.worldBookIds.filter(id => id !== book.id) })}/><span>{book.name}</span>{book.isGlobal && <span className="text-slate-400">全局</span>}</label>)}</div> : <p className="text-xs text-slate-400">暂无世界书，可先到世界书应用创建。</p>}
      </details>
      <details className="channel-profile-settings rounded-2xl bg-white p-4 shadow-sm"><summary><Save size={15} /><span>设定预设</span><small>{store.presets.length} 套</small><ChevronDown size={14} /></summary><p className="mb-3 mt-4 text-[11px] text-slate-500">保存本页全部设置，当前预设随编辑更新。</p>
        <select aria-label="切换视频号预设" value={store.activePresetId} onChange={event => {
          const preset = store.presets.find(item => item.id === event.target.value);
          if (preset) { setStore(previous => ({ ...previous, activePresetId: preset.id, settings: structuredClone(preset.settings) })); setMessage(`已切换到「${preset.name}」。`); }
          else { setStore(previous => ({ ...previous, activePresetId: '' })); setMessage('已取消预设关联，当前设置保留。'); }
        }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">当前设置（未关联预设）</option>{store.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>
        <div className="mt-3 flex gap-2"><input aria-label="视频号预设名称" value={presetName} maxLength={40} onChange={event => setPresetName(event.target.value)} placeholder={activePreset ? `更新或重命名「${activePreset.name}」` : '新预设名称'} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"/><button type="button" onClick={saveNewPreset} className="flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5"/>新增</button></div>
        {activePreset && <div className="mt-3 flex gap-2"><button type="button" onClick={updatePreset} className="flex-1 rounded-xl bg-emerald-50 py-2 text-xs font-bold text-emerald-800">更新当前预设</button><button type="button" onClick={deletePreset} className="flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"><Trash2 className="h-3.5 w-3.5"/>删除</button></div>}
      </details>
      <details className="channel-profile-settings rounded-2xl bg-white p-4 shadow-sm"><summary><Database size={15} /><span>数据管理</span><ChevronDown size={14} /></summary><div className="mt-4 space-y-3">
        <p className="channel-help">备份包含资料、预设、广场、直播、私信、收藏和关注。</p>
        <div className="flex gap-2"><button type="button" disabled={avatarBusy} onClick={() => { try { onExport(store); setMessage('已导出'); } catch (error) { setMessage(error instanceof Error ? error.message : '导出失败'); } }} className="channel-secondary-button"><Download size={15} />导出视频号</button><button type="button" disabled={avatarBusy} onClick={() => importInput.current?.click()} className="channel-secondary-button"><Upload size={15} />导入视频号</button></div>
        <input ref={importInput} type="file" accept="application/json,.json" aria-label="导入视频号文件" className="hidden" onChange={event => { void importArchive(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        <div className="channel-clear-actions">{([['posts', '广场'], ['rooms', '直播'], ['messages', '私信']] as const).map(([kind, label]) => <button key={kind} type="button" onClick={() => { if (window.confirm(`清空${label}的全部内容？此操作无法撤销。`) && onClear(kind)) setMessage(`已清空${label}`); }}><Trash2 size={14} />清空{label}</button>)}</div>
      </div></details>
      {message && <p role="status" className="px-2 text-xs text-emerald-700">{message}</p>}
    </div>
  </fieldset>;
}
