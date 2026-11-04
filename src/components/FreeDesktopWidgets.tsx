import { useEffect, useState } from 'react';
import { ArrowUpRight, Camera, Heart, Image as ImageIcon, Mail, MapPin, Package } from 'lucide-react';
import type { UserProfile } from '../types';
import { GLASS_DISC_APPEARANCE, type DesktopWidgetItem } from '../utils/freeDesktop';
import { CalendarWidget } from './CalendarWidget';
import { ListenTogetherWidget } from './ListenTogetherWidget';
import { readStoredValue } from '../utils/localStorage';
import { frameGradient } from '../utils/avatarFrame';
import { BatteryRing, TemplateBow, TemplateCloud, TemplateHeart } from './DesktopTemplateArt';

export interface DesktopCharacter { id: string; name: string; avatarUrl: string }
export function readDesktopCharacters(): DesktopCharacter[] {
  return readStoredValue<unknown[]>('pocketos:wechat-contacts', [], (value): value is unknown[] => Array.isArray(value))
    .flatMap(value => {
      if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string' || !('name' in value) || typeof value.name !== 'string') return [];
      return [{ id: value.id, name: value.name, avatarUrl: 'avatarUrl' in value && typeof value.avatarUrl === 'string' ? value.avatarUrl : '' }];
    });
}
export function desktopDateDistance(date: string, now: Date): number | null {
  if (!date) return null;
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
}
export function FreeDesktopWidget({ widget, profile, characters, onCalendar, onProfile, onNotes, onInventory, musicPortal }: {
  widget: DesktopWidgetItem; profile: UserProfile; characters: DesktopCharacter[];
  onCalendar: () => void; onProfile: () => void; onNotes: () => void; onInventory: () => void; musicPortal?: HTMLElement;
}) {
  const { settings, widgetType } = widget;
  const [now, setNow] = useState(() => new Date()), [photoIndex, setPhotoIndex] = useState(0);
  useEffect(() => {
    if (!['clock', 'countdown'].includes(widgetType)) return;
    const timer = window.setInterval(() => setNow(new Date()), widgetType === 'clock' ? 1000 : 30_000);
    return () => window.clearInterval(timer);
  }, [widgetType]);
  useEffect(() => {
    setPhotoIndex(0);
    if (widgetType !== 'photo' || settings.images.length < 2) return;
    const timer = window.setInterval(() => setPhotoIndex(index => (index + 1) % settings.images.length), settings.interval * 1000);
    return () => window.clearInterval(timer);
  }, [widgetType, settings.images, settings.interval]);
  const avatar = (url: string, name: string) => <span className="free-person-avatar">{url ? <img src={url} alt={name} draggable={false}/> : name.slice(0, 1)}</span>;
  const photo = settings.images.length ? settings.images[photoIndex % settings.images.length] : undefined;
  if (widgetType === 'calendar') return <div className="free-widget-live"><CalendarWidget onOpen={onCalendar} backgroundImage={settings.backgroundImage}/></div>;
  if (widgetType === 'music') return <div className="free-widget-live"><ListenTogetherWidget modalContainer={musicPortal} backgroundImage={settings.backgroundImage}
    variant={settings.template === 'vinyl' || settings.template === 'disc' ? settings.template : undefined} artwork={settings.images[0]} title={settings.title} note={settings.text}
    vinylColor={settings.vinylColor ?? (settings.template === 'disc' ? GLASS_DISC_APPEARANCE.color : undefined)}
    vinylOpacity={settings.vinylOpacity ?? (settings.template === 'disc' ? GLASS_DISC_APPEARANCE.opacity : undefined)}/></div>;
  if (widgetType === 'profile') return <div className="free-profile-widget">
    {!settings.backgroundImage && profile.coverImageUrl && <img className="free-profile-cover" src={profile.coverImageUrl} alt="" draggable={false}/>}
    <button type="button" className="free-profile-content" onClick={onProfile} aria-label="编辑个人资料">
      <span className="free-profile-heading"><small>YYphone</small><ArrowUpRight size={14}/></span>
      <span className="free-profile-identity"><span className="free-profile-avatar" style={profile.avatarFrame?.enabled ? { background: frameGradient(profile.avatarFrame), padding: profile.avatarFrame.width } : undefined}>
        {avatar(profile.avatarUrl ?? '', profile.name)}
      </span><span className="free-profile-copy"><strong>{profile.name}</strong><small>@{profile.handle.replace(/^@/, '')}</small></span></span>
      {profile.signature && <span className="free-profile-signature">{profile.signature}</span>}
    </button>
    <div className="free-profile-footer"><span className="free-profile-meta">{profile.location && <span><MapPin size={11}/>{profile.location}</span>}{profile.mood && <span><Heart size={11}/>{profile.mood}</span>}</span>
      <span className="free-profile-actions"><button type="button" aria-label="小纸条" onClick={onNotes}><Mail size={13}/><span>纸条</span></button><button type="button" aria-label="物品" onClick={onInventory}><Package size={13}/><span>物品</span></button></span>
    </div>
  </div>;
  if (widgetType === 'clock' && settings.template === 'capsule') return <div className="free-capsule-widget"
    style={settings.backgroundImage ? { backgroundImage: `url(${JSON.stringify(settings.backgroundImage)})` } : undefined}>
    {avatar(settings.images[0] || profile.avatarUrl || '', settings.title || profile.name)}
    <div className="free-capsule-copy"><strong title={settings.title}>{settings.title}</strong><span>{now.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' })}</span></div>
    <div className="free-capsule-time"><time dateTime={now.toISOString()}>{now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</time>{settings.text && <small title={settings.text}>{settings.text}</small>}</div>
  </div>;
  if (widgetType === 'clock') return <div className={settings.template === 'cloud' ? 'free-cloud-widget' : 'free-widget-centered'}>
    {settings.template === 'cloud' && <><TemplateCloud backgroundImage={settings.backgroundImage}/><span className="free-cloud-sparkle" aria-hidden="true">✦</span></>}
    <div className={settings.template === 'cloud' ? 'free-cloud-content' : 'free-clock-content'}><small>{settings.title || '此刻，刚刚好'}</small><strong className="free-clock-time">{now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</strong><span>{now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</span>{settings.text && <small>{settings.text}</small>}</div></div>;
  if (widgetType === 'text' && settings.template === 'battery') return <div className="free-battery-widget"
    aria-label={`自定义装饰电量 ${settings.batteryLevel ?? 85}%`}
    style={settings.backgroundImage ? { backgroundImage: `url(${JSON.stringify(settings.backgroundImage)})` } : undefined}>
    <div className="free-battery-copy"><strong>{settings.batteryLevel ?? 85}%</strong><span>{settings.title}</span>{settings.text && <small title={settings.text}>{settings.text}</small>}</div>
    <BatteryRing value={settings.batteryLevel ?? 85}/>
  </div>;
  if (widgetType === 'text') return <div className="free-text-widget"><small>{settings.title}</small><p>{settings.text || '写一点喜欢的话吧。'}</p><span>✦</span></div>;
  if (widgetType === 'photo' && settings.template === 'heart') return <div className="free-heart-widget">
    <span className="free-heart-picture" role="img" aria-label={settings.title || '心形照片'}><TemplateHeart image={photo} backgroundImage={settings.backgroundImage}/></span>
    <span className="free-template-caption"><strong>{settings.title}</strong>{settings.text && <small>{settings.text}</small>}</span>
    <span className="free-heart-sparkle" aria-hidden="true">✧</span>
  </div>;
  if (widgetType === 'photo' && settings.template === 'bow') return <div className="free-bow-widget">
    <div className="free-polaroid" style={settings.backgroundImage ? { backgroundImage: `url(${JSON.stringify(settings.backgroundImage)})` } : undefined}>
      <TemplateBow/><div className="free-polaroid-picture">{settings.images.length ? <img src={settings.images[photoIndex % settings.images.length]} alt={settings.title || '拍立得照片'} draggable={false}/> : <span className="free-photo-empty"><ImageIcon/><small>换一张喜欢的照片</small></span>}</div>
      <span className="free-template-caption"><strong>{settings.title}</strong>{settings.text && <small>{settings.text}</small>}</span>
    </div>
  </div>;
  if (widgetType === 'photo') return <div className="free-photo-widget">
    {settings.images.length ? <img src={settings.images[photoIndex % settings.images.length]} alt={settings.title || '相册照片'} draggable={false}/> : <span className="free-photo-empty"><ImageIcon/><small>放一张喜欢的照片</small></span>}
    {(settings.title || settings.text) && <span className="free-photo-caption"><strong>{settings.title}</strong><small>{settings.text}</small></span>}
    {settings.images.length > 1 && <span className="free-photo-dots" aria-label={`第 ${(photoIndex % settings.images.length) + 1} 张，共 ${settings.images.length} 张`}>{settings.images.map((_, index) => <i key={index} data-current={index === photoIndex % settings.images.length || undefined}/>)}</span>}
  </div>;
  if (widgetType === 'countdown') {
    const days = desktopDateDistance(settings.date, now);
    return <div className="free-widget-centered free-countdown-widget"><small>{settings.title || '值得记住的一天'}</small><strong>{days === null ? '—' : Math.abs(days)}<span>天</span></strong><span>{days === null ? '编辑组件，选择日期' : days === 0 ? '就是今天' : days > 0 ? '还有这些期待' : '已经一起走过'}</span><small>{settings.date || settings.text}</small></div>;
  }
  const people = [
    ...(settings.includePlayer ? [{ id: 'player', name: profile.name, avatarUrl: profile.avatarUrl ?? '' }] : []),
    ...settings.characterIds.map(id => characters.find(person => person.id === id)),
  ];
  const personAt = (index: number) => {
    const person = people[index];
    const missing = !person && index >= (settings.includePlayer ? 1 : 0) && !!settings.characterIds[index - (settings.includePlayer ? 1 : 0)];
    return {
      name: missing ? '角色已不存在' : settings.personNames?.[index] || person?.name || (index === 0 ? '你' : 'TA'),
      avatarUrl: settings.images[index] || person?.avatarUrl || '',
    };
  };
  if (settings.template === 'portrait') {
    const person = personAt(0);
    return <div className="free-portrait-widget">
      <div className="free-portrait-cover" style={settings.backgroundImage ? { backgroundImage: `url(${JSON.stringify(settings.backgroundImage)})` } : undefined}/>
      <div className="free-portrait-card">
        {avatar(person.avatarUrl, person.name)}
        <strong className="free-portrait-name">{settings.title || person.name}</strong>
        {settings.subtitle && <span className="free-portrait-subtitle">{settings.subtitle}</span>}
        {settings.text && <p className="free-portrait-note">{settings.text}</p>}
        {settings.location && <span className="free-portrait-location"><MapPin size={12}/>{settings.location}</span>}
      </div>
    </div>;
  }
  if (settings.template === 'whisper') return <div className="free-whisper-widget">
    {[settings.title, settings.text].map((text, index) => {
      const person = personAt(index);
      return <div className="free-whisper-pill" key={index}
        style={settings.backgroundImage ? { backgroundImage: `url(${JSON.stringify(settings.backgroundImage)})` } : undefined}>
        {avatar(person.avatarUrl, person.name)}<span title={text}>{text}</span>
      </div>;
    })}
  </div>;
  if (settings.template === 'ticket') return <div className="free-ticket-widget">
    <div className="free-ticket-paper" style={settings.backgroundImage ? { backgroundImage: `url(${JSON.stringify(settings.backgroundImage)})` } : undefined}>
      <div className="free-ticket-main"><small className="free-ticket-heading">TWO LITTLE WORLDS <Heart size={12}/></small>
        <strong className="free-ticket-title">{settings.title || '只属于我们的纪念'}</strong>
        <div className="free-ticket-people">{[0, 1].map(index => {
          const person = personAt(index);
          return <span key={index}>{avatar(person.avatarUrl, person.name)}<small>{person.name}</small></span>;
        })}<Heart className="free-ticket-heart" size={16}/></div>
        {settings.text && <p className="free-ticket-note">{settings.text}</p>}
      </div><span className="free-ticket-stub" aria-hidden="true"><span>ONLY US</span><i/><small>02</small></span>
    </div>
  </div>;
  return <div className="free-widget-centered free-character-widget">
    <small>{settings.title || '把喜欢的人，放在眼前'}</small>
    {settings.images.length ? <img className="free-couple-photo" src={settings.images[0]} alt={settings.title || '双人合照'} draggable={false}/> : <div className="free-character-pair">
      {people.length ? people.map((person, index) => <span key={`${index}:${person?.id ?? 'missing'}`}>{avatar(person?.avatarUrl ?? '', person?.name ?? '?')}<small>{person?.name ?? '角色已不存在'}</small></span>) : <span className="free-photo-empty"><Camera/><small>编辑组件，选择角色或合照</small></span>}
      {people.length === 2 && <Heart className="free-pair-heart" size={14}/>}
    </div>}
    {settings.text && <small>{settings.text}</small>}
  </div>;
}
