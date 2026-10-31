import React, { useState } from 'react';
import {
  MessageCircle,
  Smartphone,
  Coins,
  ShoppingBag,
  Flame,
  Timer,
  Compass,
  HeartHandshake,
  Settings,
  Palette,
  BookOpen,
  Sparkles,
  MapPin,
  Pencil,
  Package,
  Mail,
} from 'lucide-react';
import { AppIconOverrides, AppId, AppMetadata, UserProfile } from '../types';
import { ProfileEditor } from './ProfileEditor';
import { ListenTogetherWidget } from './ListenTogetherWidget';
import { CalendarWidget } from './CalendarWidget';
import { frameGradient } from '../utils/avatarFrame';
import { PaperNotes } from './PaperNotes';
import { MinimalHome } from './MinimalHome';
import { HalloweenHome } from './HalloweenHome';

interface HomeScreenProps {
  wallpaperUrl?: string;
  homeStyle?: 'classic' | 'minimal' | 'moonlit' | 'halloween';
  userProfile: UserProfile;
  apps: AppMetadata[];
  dockApps: AppMetadata[];
  onOpenApp: (id: AppId) => void;
  onSaveUserProfile: (profile: UserProfile) => boolean;
  appIcons: AppIconOverrides;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  userProfile,
  apps,
  dockApps,
  onOpenApp,
  onSaveUserProfile,
  appIcons,
  homeStyle,
  wallpaperUrl,
}) => {
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [paperNotesOpen, setPaperNotesOpen] = useState(false);
  // 新头像框优先；没有时沿用旧的“奶油花边框”开关
  const frameOn = userProfile.avatarFrame ? userProfile.avatarFrame.enabled : !!userProfile.avatarFrameEnabled;


  // Top-right 4 apps: 微信, 查手机, 支付宝, 淘宝
  const topRightApps = apps.slice(0, 4);
  // Bottom-left 4 apps: 论坛, 番茄钟, 线下, 情侣空间
  const bottomLeftApps = apps.slice(4, 8);

  const renderAppIcon = (
    iconName: string,
    className = 'w-6 h-6 text-[#587589]'
  ) => {
    switch (iconName) {
      case 'MessageCircle':
        return <MessageCircle className={className} />;
      case 'Smartphone':
        return <Smartphone className={className} />;
      case 'Coins':
        return <Coins className={className} />;
      case 'ShoppingBag':
        return <ShoppingBag className={className} />;
      case 'Flame':
        return <Flame className={className} />;
      case 'Timer':
        return <Timer className={className} />;
      case 'Compass':
        return <Compass className={className} />;
      case 'HeartHandshake':
        return <HeartHandshake className={className} />;
      case 'BookOpen':
        return <BookOpen className={className} />;
      case 'Palette':
        return <Palette className={className} />;
      case 'Settings':
        return <Settings className={className} />;
      case 'Sparkles':
        return <Sparkles className={className} />;
      default:
        return <Sparkles className={className} />;
    }
  };

  // Responsive App Button for 2x2 grid inside square blocks
  const renderAppButton = (app: AppMetadata) => (
    <button
      key={app.id}
      onClick={() => onOpenApp(app.id)}
      className="flex flex-col items-center justify-center group cursor-pointer active:scale-92 transition-transform p-1 w-full"
    >
      <div className="relative">
        <div className={`w-[clamp(44px,12.5vw,62px)] h-[clamp(44px,12.5vw,62px)] rounded-[clamp(14px,3.6vw,20px)] shadow-[0_4px_16px_rgba(180,210,230,0.35)] flex items-center justify-center relative overflow-hidden transition-all group-hover:shadow-[0_8px_24px_rgba(180,210,230,0.5)] ${
          appIcons[app.id] ? '' : 'home-default-icon ' + 'bg-white/50 backdrop-blur-xl border border-white/80 group-hover:bg-white/70'
        }`}>
          {appIcons[app.id] ? (
            <img src={appIcons[app.id]} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <div
                className={`absolute inset-0 bg-gradient-to-br ${app.color} opacity-80 pointer-events-none`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent pointer-events-none" />

              <div className="relative z-10">
                {renderAppIcon(
                  app.iconName,
                  `w-[clamp(22px,6vw,28px)] h-[clamp(22px,6vw,28px)] ${
                    app.textColor || 'text-[#587589]'
                  } stroke-[2.2] drop-shadow-xs`
                )}
              </div>
            </>
          )}
        </div>

        {/* Badge */}
        {app.badge && (
          <span className="absolute -top-1 -right-1 px-1.5 min-w-[15px] h-[15px] rounded-full bg-rose-500 text-white text-[9.5px] font-bold flex items-center justify-center shadow-xs border border-white">
            {app.badge}
          </span>
        )}
      </div>

      <span className="mt-[clamp(2px,0.5vh,4px)] text-[clamp(10px,2.6vw,12px)] font-semibold text-[#587589] tracking-tight truncate max-w-[68px] text-center leading-tight">
        {app.name}
      </span>
    </button>
  );

  if (homeStyle === 'halloween') return <><HalloweenHome wallpaperUrl={wallpaperUrl} userProfile={userProfile} apps={apps} dockApps={dockApps} appIcons={appIcons} onOpenApp={onOpenApp} renderIcon={renderAppIcon} onEditProfile={() => setIsProfileEditorOpen(true)} onOpenNotes={() => setPaperNotesOpen(true)}/>{isProfileEditorOpen && <ProfileEditor profile={userProfile} onSave={onSaveUserProfile} onClose={() => setIsProfileEditorOpen(false)}/>}{paperNotesOpen && <PaperNotes onClose={() => setPaperNotesOpen(false)}/>}</>;
  if (homeStyle === 'minimal' || homeStyle === 'moonlit') return <><MinimalHome variant={homeStyle} wallpaperUrl={wallpaperUrl} userProfile={userProfile} apps={apps} dockApps={dockApps} appIcons={appIcons} onOpenApp={onOpenApp} renderIcon={renderAppIcon} onEditProfile={() => setIsProfileEditorOpen(true)} onOpenNotes={() => setPaperNotesOpen(true)} />{isProfileEditorOpen && <ProfileEditor profile={userProfile} onSave={onSaveUserProfile} onClose={() => setIsProfileEditorOpen(false)} />}{paperNotesOpen && <PaperNotes onClose={() => setPaperNotesOpen(false)} />}</>;
  return (
    <div className="home-desktop classic-home relative w-full h-full flex flex-col justify-between overflow-hidden select-none">
      {/* Upper Content Area (Profile Card + 4 Quadrants Grid) */}
      <div className="w-full flex-1 min-h-0 flex flex-col justify-between px-[clamp(12px,3vw,18px)] pt-1 pb-1.5 overflow-hidden">
        {/* 
          Section 1: Player Personal Profile Card
        - Generous & spacious height with banner, avatar, mood pill, bio, and stats
        - Flexible card that does not shrink into a tiny ribbon
      */}
      <div className="w-full shrink-0 glass-card rounded-[clamp(20px,4.5vw,28px)] overflow-hidden transition-all shadow-sm flex flex-col">
        {/* Cover Art Banner */}
        <div
          className="h-[clamp(44px,7.5vh,58px)] w-full bg-gradient-to-r from-sky-200 via-blue-100 to-pink-100 relative overflow-hidden flex items-center justify-end px-3.5 shrink-0 bg-cover bg-center"
        >
          {userProfile.coverImageUrl && (
            <img
              src={userProfile.coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {!userProfile.coverImageUrl && <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.8),transparent_60%)]" />}
        </div>

        {/* Profile Content Body */}
        <div className="px-3.5 pb-2.5 pt-0 relative flex flex-col">
          {/* Avatar & Mood pill row */}
          <div className="flex items-end justify-between -mt-[clamp(27px,6.9vw,31px)] mb-1">
            <div className="relative">
              <div
                className={`flex items-center justify-center ${
                  frameOn
                    ? 'h-[clamp(54px,13.8vw,62px)] w-[clamp(54px,13.8vw,62px)] rounded-[38%] shadow-sm'
                    : 'h-[clamp(54px,13.8vw,62px)] w-[clamp(54px,13.8vw,62px)] rounded-[38%]'
                }`}
                style={frameOn ? (userProfile.avatarFrame ? {
                  background: frameGradient(userProfile.avatarFrame),
                  padding: `${userProfile.avatarFrame.width}px`,
                  boxShadow: '0 2px 8px rgba(160, 175, 200, 0.22)',
                } : {
                  background: 'linear-gradient(135deg, #f5c9d9 0%, #fff0dc 48%, #cde8f4 100%)',
                  padding: '4px',
                  boxShadow: '0 2px 8px rgba(221, 153, 177, 0.22)',
                }) : undefined}
              >
                {userProfile.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={`${userProfile.name} 的头像`}
                    className={`h-full w-full object-cover ${frameOn ? 'rounded-[32%] border-2 border-[#fff8ed]' : 'rounded-[inherit]'}`}
                  />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center bg-white/90 font-bold text-[#587589] text-[clamp(20px,5vw,24px)] backdrop-blur-sm ${frameOn ? 'rounded-[32%] border-2 border-[#fff8ed]' : 'rounded-[inherit]'}`}>
                    {userProfile.name.trim().charAt(0) || '?'}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-lg bg-white/75 text-[#587589] border border-white/80 shadow-2xs">
                {userProfile.mood}
              </span>
            </div>
          </div>

          {/* Name & Handle */}
          <div className="flex items-baseline justify-between mb-0.5">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[clamp(13.5px,3.5vw,16px)] font-bold text-[#587589] tracking-tight">
                {userProfile.name}
              </h2>
            </div>
            <span className="text-[10.5px] text-slate-500 font-mono">
              {userProfile.handle}
            </span>
          </div>

          {/* Signature / Bio + profile actions */}
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-[clamp(10px,2.5vw,11.5px)] text-[#587589]/85 line-clamp-1 font-normal leading-snug">
              {userProfile.signature}
            </p>
            <button type="button" aria-label="编辑资料" title="编辑资料" onClick={() => setIsProfileEditorOpen(true)}
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg border border-white/80 bg-gradient-to-br from-[#DCEEFF] to-white text-[#6F8CA0] shadow-2xs active:scale-90">
              <Pencil className="h-3 w-3" />
            </button>
            <button type="button" aria-label="小纸条" title="小纸条" onClick={() => setPaperNotesOpen(true)}
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg border border-white/80 bg-gradient-to-br from-[#DCEEFF] to-white text-[#6F8CA0] shadow-2xs active:scale-90">
              <Mail className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => onOpenApp('inventory')}
              aria-label="物品"
              title="物品"
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg border border-white/80 bg-gradient-to-br from-[#DCEEFF] to-white text-[#6F8CA0] shadow-2xs active:scale-90"
            >
              <Package className="h-3 w-3" />
            </button>
          </div>

          {/* Bottom stats row */}
          <div className="pt-1.5 border-t border-white/50 flex items-center justify-between text-[10px] text-slate-600">
            <div className="flex items-center gap-1 text-slate-500">
              <MapPin className="w-3 h-3 text-sky-500 shrink-0" />
              <span className="truncate max-w-[140px]">{userProfile.location}</span>
            </div>
            <div className="flex items-center gap-2 font-mono tabular-nums text-[10px]">
              <span><strong>{userProfile.stats.moments}</strong> 动态</span>
              <span className="text-slate-300">·</span>
              <span><strong>{userProfile.stats.notes}</strong> 随笔</span>
            </div>
          </div>
        </div>
      </div>

      {/* Home widgets and app groups retain the 2×2 phone home layout. */}
      <div className="grid grid-cols-2 gap-[clamp(10px,2.6vw,14px)] w-full my-auto shrink-0">
        {/* Music widget */}
        <ListenTogetherWidget />

        <div className="aspect-square grid grid-cols-2 grid-rows-2 items-center justify-items-center gap-1">
          {topRightApps.map(renderAppButton)}
        </div>

        <div className="aspect-square grid grid-cols-2 grid-rows-2 items-center justify-items-center gap-1">
          {bottomLeftApps.map(renderAppButton)}
        </div>

        {/* Calendar widget */}
        <CalendarWidget onOpen={() => onOpenApp('calendar')} />
      </div>
    </div>

      {/* Floating iOS-style translucent app dock */}
      <div className="home-dock mx-4 mb-1.5 w-auto shrink-0 rounded-[28px] border border-white/75 bg-white/45 px-2 py-2 backdrop-blur-2xl shadow-[0_8px_28px_rgba(108,144,168,0.2),inset_0_1px_0_rgba(255,255,255,0.75)] flex items-center justify-around z-20">
        {dockApps.map((dockApp) => (
          <button
            key={dockApp.id}
            onClick={() => onOpenApp(dockApp.id)}
            className="flex flex-col items-center cursor-pointer active:scale-90 transition-transform group py-0.5 px-2"
          >
            <div className={`w-[clamp(44px,11.8vw,54px)] h-[clamp(44px,11.8vw,54px)] rounded-[clamp(13px,3.2vw,17px)] shadow-[0_3px_12px_rgba(180,210,230,0.25)] flex items-center justify-center relative overflow-hidden transition-all group-hover:-translate-y-0.5 ${
              appIcons[dockApp.id] ? '' : 'home-default-icon ' + 'bg-white/50 backdrop-blur-xl border border-white/80 group-hover:bg-white/70'
            }`}>
              {appIcons[dockApp.id] ? (
                <img src={appIcons[dockApp.id]} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <>
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${dockApp.color} opacity-80 pointer-events-none`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent pointer-events-none" />

                  <div className="relative z-10">
                    {renderAppIcon(
                      dockApp.iconName,
                      `w-[clamp(22px,5.8vw,26px)] h-[clamp(22px,5.8vw,26px)] ${
                        dockApp.textColor || 'text-[#587589]'
                      } stroke-[2.2] drop-shadow-xs`
                    )}
                  </div>
                </>
              )}
            </div>
            <span className="mt-[clamp(2px,0.4vh,3px)] text-[clamp(10px,2.5vw,11.5px)] font-semibold text-[#587589] leading-tight">
              {dockApp.name}
            </span>
          </button>
        ))}
      </div>
      <footer className="shrink-0 pb-1.5 text-center text-[10px] font-mono font-bold tracking-wide text-[#587589]/70">
        YYphone
      </footer>
      {isProfileEditorOpen && (
        <ProfileEditor
          profile={userProfile}
          onSave={onSaveUserProfile}
          onClose={() => setIsProfileEditorOpen(false)}
        />
      )}
      {paperNotesOpen && <PaperNotes onClose={() => setPaperNotesOpen(false)} />}
    </div>
  );
};
