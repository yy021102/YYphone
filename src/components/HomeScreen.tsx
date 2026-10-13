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
  Music2,
  Play,
  Pause,
  SkipForward,
  Camera,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { AppIconOverrides, AppId, AppMetadata, UserProfile } from '../types';
import { ProfileEditor } from './ProfileEditor';

interface HomeScreenProps {
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
}) => {
  // Static audio widget state
  const [isPlaying, setIsPlaying] = useState(false);

  // Photo widget preset list for quick switching
  const photoPresets = [
    {
      title: '浮光浅滩霞光',
      date: '10月12日 · 晴',
      gradient: 'linear-gradient(135deg, #CEE9F7 0%, #FAD4E0 55%, #FFFFFF 100%)',
      sticker: '🌅 浅滩微风',
    },
    {
      title: '图书馆窗边微雨',
      date: '10月09日 · 雨',
      gradient: 'linear-gradient(135deg, #DFF1FA 0%, #BFE3F7 60%, #FFFFFF 100%)',
      sticker: '🌧️ 窗边水滴',
    },
    {
      title: '星空下双人书签',
      date: '10月04日 · 夜',
      gradient: 'linear-gradient(135deg, #EBE7FA 0%, #D4C7F5 60%, #FFFFFF 100%)',
      sticker: '✨ 灵犀闪烁',
    },
  ];
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev + 1) % photoPresets.length);
  };

  // Top-right 4 apps: 微信, 查手机, 支付宝, 淘宝
  const topRightApps = apps.slice(0, 4);
  // Bottom-left 4 apps: 论坛, 番茄钟, 线下, 情侣空间
  const bottomLeftApps = apps.slice(4, 8);

  const renderAppIcon = (
    iconName: string,
    className = 'w-6 h-6 text-[#2C4A5C]',
    imageUrl?: string
  ) => {
    if (imageUrl) {
      return <img src={imageUrl} alt="" className={`${className} object-cover rounded-[22%]`} />;
    }
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
        <div className="w-[clamp(44px,12.5vw,62px)] h-[clamp(44px,12.5vw,62px)] rounded-[clamp(14px,3.6vw,20px)] bg-white/50 backdrop-blur-xl border border-white/80 shadow-[0_4px_16px_rgba(180,210,230,0.35)] flex items-center justify-center relative overflow-hidden transition-all group-hover:bg-white/70 group-hover:shadow-[0_8px_24px_rgba(180,210,230,0.5)]">
          {/* Subtle translucent tinted sheen */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${app.color} opacity-80 pointer-events-none`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent pointer-events-none" />

          {/* Icon */}
          <div className="relative z-10">
            {renderAppIcon(
              app.iconName,
              `w-[clamp(22px,6vw,28px)] h-[clamp(22px,6vw,28px)] ${
                app.textColor || 'text-[#2C4A5C]'
              } stroke-[2.2] drop-shadow-xs`,
              appIcons[app.id]
            )}
          </div>
        </div>

        {/* Badge */}
        {app.badge && (
          <span className="absolute -top-1 -right-1 px-1.5 min-w-[15px] h-[15px] rounded-full bg-rose-500 text-white text-[9.5px] font-bold flex items-center justify-center shadow-xs border border-white">
            {app.badge}
          </span>
        )}
      </div>

      <span className="mt-[clamp(2px,0.5vh,4px)] text-[clamp(10px,2.6vw,12px)] font-bold text-[#2C4A5C] tracking-tight truncate max-w-[68px] text-center leading-tight">
        {app.name}
      </span>
    </button>
  );

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none">
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
          className="h-[clamp(44px,7.5vh,58px)] w-full bg-gradient-to-r from-sky-200 via-blue-100 to-pink-100 relative overflow-hidden flex items-center justify-between px-3.5 shrink-0 bg-cover bg-center"
        >
          {userProfile.coverImageUrl && (
            <img
              src={userProfile.coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.8),transparent_60%)]" />
          <span className="text-[11px] font-mono font-bold text-[#2C4A5C]/80 relative z-10 tracking-wide">
            YYphone·歪歪机
          </span>
          <button
            type="button"
            onClick={() => setIsProfileEditorOpen(true)}
            aria-label="编辑资料"
            title="编辑资料"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/80 backdrop-blur-md text-[#2C4A5C] border border-white/75 shadow-2xs relative z-10"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>

        {/* Profile Content Body */}
        <div className="px-3.5 pb-2.5 pt-0 relative flex flex-col">
          {/* Avatar & Mood pill row */}
          <div className="flex items-end justify-between -mt-5 mb-1">
            <div className="relative">
              <div className="w-[clamp(44px,11vw,52px)] h-[clamp(44px,11vw,52px)] rounded-[clamp(12px,3vw,16px)] bg-gradient-to-tr from-sky-400 via-teal-300 to-pink-300 p-0.5 shadow-md">
                {userProfile.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={`${userProfile.name} 的头像`}
                    className="w-full h-full rounded-[clamp(10px,2.6vw,14px)] object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-[clamp(10px,2.6vw,14px)] bg-white flex items-center justify-center font-bold text-[#2C4A5C] text-[clamp(15px,3.8vw,18px)] backdrop-blur-sm">
                    {userProfile.name.trim().charAt(0) || '?'}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-lg bg-white/75 text-[#2C4A5C] border border-white/80 shadow-2xs">
                {userProfile.mood}
              </span>
            </div>
          </div>

          {/* Name & Handle */}
          <div className="flex items-baseline justify-between mb-0.5">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[clamp(13.5px,3.5vw,16px)] font-bold text-[#2C4A5C] tracking-tight">
                {userProfile.name}
              </h2>
            </div>
            <span className="text-[10.5px] text-slate-500 font-mono">
              {userProfile.handle}
            </span>
          </div>

          {/* Signature / Bio */}
          <p className="text-[clamp(10px,2.5vw,11.5px)] text-[#2C4A5C]/85 line-clamp-1 font-normal mb-1.5 leading-snug">
            {userProfile.signature}
          </p>

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

      {/* 
        Section 2: The 2x2 "田字格" Blocks
        - Distributed evenly in the vertical center
        - Strictly SQUARE aspect ratio (`aspect-square`) for all 4 blocks
        - Large, clear icons scaling with clamp()
      */}
      <div className="grid grid-cols-2 gap-[clamp(10px,2.6vw,14px)] w-full my-auto shrink-0">
        {/* ============================== */}
        {/* 左上区块：桌面小组件 “一起听歌” (Strict Square) */}
        {/* ============================== */}
        <div className="glass-card rounded-[clamp(20px,4.8vw,28px)] p-[clamp(9px,2.4vw,13px)] aspect-square flex flex-col justify-between overflow-hidden relative shadow-sm">
          {/* Top header */}
          <div className="flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-[clamp(20px,5vw,24px)] h-[clamp(20px,5vw,24px)] rounded-lg bg-sky-100/90 text-sky-700 flex items-center justify-center">
                <Music2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-[clamp(11px,2.8vw,13px)] font-bold text-[#2C4A5C]">一起听歌</span>
            </div>
            <span className="flex items-center gap-0.5">
              <span className="w-1 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="w-1 h-3 rounded-full bg-pink-400 animate-pulse delay-100" />
              <span className="w-1 h-1.5 rounded-full bg-sky-400 animate-pulse delay-200" />
            </span>
          </div>

          {/* Middle: Music Album Art & Song Info */}
          <div className="flex items-center gap-2.5 my-auto z-10 min-h-0">
            {/* Vinyl disc */}
            <div className="relative shrink-0">
              <div
                className={`w-[clamp(36px,9.5vw,48px)] h-[clamp(36px,9.5vw,48px)] rounded-full p-0.5 shadow-sm bg-gradient-to-tr from-sky-300 via-pink-200 to-indigo-300 border border-white/80 flex items-center justify-center ${
                  isPlaying ? 'animate-spin [animation-duration:8s]' : ''
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-slate-800/80 border border-white flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                </div>
              </div>
            </div>

            {/* Title & Artist */}
            <div className="flex-1 min-w-0">
              <h4 className="text-[clamp(11px,2.8vw,12.5px)] font-bold text-[#2C4A5C] truncate">
                浅海微澜与晨光
              </h4>
              <p className="text-[clamp(9px,2.2vw,10.5px)] text-slate-500 truncate mt-0.5">
                星野遥 & 沐晴
              </p>
            </div>
          </div>

          {/* Bottom: Progress Bar & Controls */}
          <div className="space-y-1 z-10 shrink-0">
            <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-sky-400 to-pink-400 h-full w-[48%]" />
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[8.5px] text-slate-400 font-mono">01:42</span>

              {/* Control Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-[clamp(22px,6vw,28px)] h-[clamp(22px,6vw,28px)] rounded-full bg-white/80 hover:bg-white text-[#2C4A5C] flex items-center justify-center shadow-2xs active:scale-90 transition-all cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-3 h-3 fill-[#2C4A5C]" />
                  ) : (
                    <Play className="w-3 h-3 fill-[#2C4A5C] ml-0.5" />
                  )}
                </button>
                <button
                  onClick={() => setIsPlaying(true)}
                  className="w-[clamp(20px,5vw,24px)] h-[clamp(20px,5vw,24px)] rounded-full hover:bg-white/50 text-slate-500 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                >
                  <SkipForward className="w-3 h-3" />
                </button>
              </div>

              <span className="text-[8.5px] text-slate-400 font-mono">03:35</span>
            </div>
          </div>
        </div>

        {/* ============================== */}
        {/* 右上区块：4 个 App (Strict Square, 2x2 Grid) */}
        {/* ============================== */}
        <div className="glass-card rounded-[clamp(20px,4.8vw,28px)] p-[clamp(6px,1.8vw,10px)] aspect-square grid grid-cols-2 grid-rows-2 items-center justify-items-center gap-1 overflow-hidden shadow-sm">
          {topRightApps.map(renderAppButton)}
        </div>

        {/* ============================== */}
        {/* 左下区块：4 个 App (Strict Square, 2x2 Grid) */}
        {/* ============================== */}
        <div className="glass-card rounded-[clamp(20px,4.8vw,28px)] p-[clamp(6px,1.8vw,10px)] aspect-square grid grid-cols-2 grid-rows-2 items-center justify-items-center gap-1 overflow-hidden shadow-sm">
          {bottomLeftApps.map(renderAppButton)}
        </div>

        {/* ============================== */}
        {/* 右下区块：桌面小组件 “相片相框” (Strict Square) */}
        {/* ============================== */}
        <div
          onClick={handleNextPhoto}
          className="glass-card rounded-[clamp(20px,4.8vw,28px)] p-[clamp(9px,2.4vw,13px)] aspect-square flex flex-col justify-between overflow-hidden relative shadow-sm group cursor-pointer active:scale-[0.98] transition-all"
        >
          {/* Background preview */}
          <div
            className="absolute inset-0 transition-all duration-500 opacity-90 group-hover:scale-105"
            style={{ background: photoPresets[photoIndex].gradient }}
          />
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-bold text-[#2C4A5C] bg-white/75 px-2 py-0.5 rounded-full shadow-2xs backdrop-blur-xs flex items-center gap-1">
              <Camera className="w-2.5 h-2.5 text-pink-500" />
              <span>相片相框</span>
            </span>

            <button
              onClick={handleNextPhoto}
              title="轻触更换相片"
              className="w-5.5 h-5.5 rounded-full bg-white/70 hover:bg-white text-[#2C4A5C] flex items-center justify-center shadow-xs transition-all active:rotate-180"
            >
              <RefreshCw className="w-3 h-3 text-slate-600" />
            </button>
          </div>

          {/* Middle: Polaroid style sticker */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto min-h-0">
            <div className="w-[clamp(36px,9.5vw,46px)] h-[clamp(36px,9.5vw,46px)] rounded-[clamp(11px,2.8vw,16px)] bg-white/70 border border-white/85 shadow-xs flex items-center justify-center text-[clamp(18px,4.8vw,24px)] backdrop-blur-md group-hover:scale-105 transition-transform">
              {photoIndex === 0 ? '🌅' : photoIndex === 1 ? '🌧️' : '🌌'}
            </div>
            <span className="text-[10px] text-[#2C4A5C] font-bold mt-1">
              {photoPresets[photoIndex].sticker}
            </span>
          </div>

          {/* Bottom */}
          <div className="relative z-10 flex items-baseline justify-between pt-0.5 border-t border-white/40 shrink-0">
            <span className="text-[9px] text-[#2C4A5C]/85 font-medium truncate max-w-[85px]">
              {photoPresets[photoIndex].title}
            </span>
            <span className="text-[8.5px] text-slate-500 font-mono">
              点我切换
            </span>
          </div>
        </div>
      </div>
    </div>

      {/* 
        Section 3: Bottom Dock Bar (Firmly attached to screen bottom)
        Contains 4 apps: 设置, 美化, 世界书, 记忆
        - Background bleeds to the bottom edge with micro-buffer safe area
        - No gaps or floating disconnection
      */}
      <div className="w-full shrink-0 border-t border-white/60 bg-white/45 backdrop-blur-xl px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom,0px),8px)] flex items-center justify-around shadow-[0_-4px_16px_rgba(180,210,230,0.15)] z-20">
        {dockApps.map((dockApp) => (
          <button
            key={dockApp.id}
            onClick={() => onOpenApp(dockApp.id)}
            className="flex flex-col items-center cursor-pointer active:scale-90 transition-transform group py-0.5 px-2"
          >
            <div className="w-[clamp(44px,11.8vw,54px)] h-[clamp(44px,11.8vw,54px)] rounded-[clamp(13px,3.2vw,17px)] bg-white/50 backdrop-blur-xl border border-white/80 shadow-[0_3px_12px_rgba(180,210,230,0.25)] flex items-center justify-center relative overflow-hidden transition-all group-hover:bg-white/70 group-hover:-translate-y-0.5">
              {/* Soft translucent sheen */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${dockApp.color} opacity-80 pointer-events-none`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent pointer-events-none" />

              <div className="relative z-10">
                {renderAppIcon(
                  dockApp.iconName,
                  `w-[clamp(22px,5.8vw,26px)] h-[clamp(22px,5.8vw,26px)] ${
                    dockApp.textColor || 'text-[#2C4A5C]'
                  } stroke-[2.2] drop-shadow-xs`,
                  appIcons[dockApp.id]
                )}
              </div>
            </div>
            <span className="mt-[clamp(2px,0.4vh,3px)] text-[clamp(10px,2.5vw,11.5px)] font-bold text-[#2C4A5C] leading-tight">
              {dockApp.name}
            </span>
          </button>
        ))}
      </div>
      {isProfileEditorOpen && (
        <ProfileEditor
          profile={userProfile}
          onSave={onSaveUserProfile}
          onClose={() => setIsProfileEditorOpen(false)}
        />
      )}
    </div>
  );
};
