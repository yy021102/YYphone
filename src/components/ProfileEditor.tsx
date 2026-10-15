import React, { useState } from 'react';
import { X } from 'lucide-react';
import { UserProfile } from '../types';
import { compressImageFile } from '../utils/imageFile';

interface ProfileEditorProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => boolean;
  onClose: () => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  profile,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState(profile);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const updateField = (
    field:
      | 'name'
      | 'handle'
      | 'signature'
      | 'mood'
      | 'location'
      | 'avatarUrl'
      | 'coverImageUrl',
    value: string
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus('');
    setError('');
  };

  const handleImageFile = async (
    field: 'avatarUrl' | 'coverImageUrl',
    file?: File
  ) => {
    if (!file) return;
    setIsProcessingImage(true);
    setError('');
    try {
      const dataUrl = await compressImageFile(file);
      updateField(field, dataUrl);
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : '图片处理失败。');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      setError('昵称不能为空。');
      return;
    }

    const updatedProfile = {
      ...draft,
      name: draft.name.trim(),
      handle: draft.handle.trim(),
      signature: draft.signature.trim(),
      avatarUrl: draft.avatarUrl?.trim() || '',
      coverImageUrl: draft.coverImageUrl?.trim() || '',
    };
    if (!onSave(updatedProfile)) {
      setError('保存失败，浏览器本地存储空间可能不足。请换用更小的图片后重试。');
      return;
    }
    setStatus('资料已保存。');
    onClose();
  };

  const fileInput = (
    field: 'avatarUrl' | 'coverImageUrl',
    label: string
  ) => (
    <label className="flex items-center justify-between gap-3 text-[11px] text-[#2C4A5C]">
      <span>{label}（本地图片）</span>
      <input
        type="file"
        accept="image/*"
        disabled={isProcessingImage}
        onChange={(event) => {
          void handleImageFile(field, event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
        className="max-w-[180px] text-[10px]"
      />
    </label>
  );

  return (
    <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-editor-title"
        className="w-full sm:max-w-md max-h-[90%] overflow-y-auto no-scrollbar bg-white/95 rounded-t-3xl sm:rounded-3xl p-4 space-y-3 shadow-2xl"
      >
        <header className="flex items-center justify-between">
          <h2 id="profile-editor-title" className="text-sm font-bold text-[#2C4A5C]">编辑玩家资料</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="p-1 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </header>

        <label className="block text-[11px] font-semibold text-[#2C4A5C]">
          昵称
          <input
            value={draft.name}
            onChange={(event) => updateField('name', event.target.value)}
            maxLength={40}
            className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
          />
        </label>
        <label className="block text-[11px] font-semibold text-[#2C4A5C]">
          账号 / 微信号
          <input
            value={draft.handle}
            onChange={(event) => updateField('handle', event.target.value)}
            maxLength={60}
            className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
          />
        </label>
        <label className="block text-[11px] font-semibold text-[#2C4A5C]">
          个性签名
          <textarea
            value={draft.signature}
            onChange={(event) => updateField('signature', event.target.value)}
            maxLength={200}
            rows={2}
            className="mt-1 w-full resize-y bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
          />
        </label>

        <label className="block text-[11px] font-semibold text-[#2C4A5C]">
          心情状态
          <input
            value={draft.mood}
            onChange={(event) => updateField('mood', event.target.value)}
            maxLength={80}
            className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
          />
        </label>
        <label className="block text-[11px] font-semibold text-[#2C4A5C]">
          所在位置
          <input
            value={draft.location}
            onChange={(event) => updateField('location', event.target.value)}
            maxLength={80}
            className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['moments', '动态数量'],
            ['notes', '随笔数量'],
          ] as const).map(([field, label]) => (
            <label key={field} className="block text-[11px] font-semibold text-[#2C4A5C]">
              {label}
              <input
                type="number"
                min={0}
                value={draft.stats[field]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    stats: {
                      ...current.stats,
                      [field]: Math.max(0, Number(event.target.value) || 0),
                    },
                  }))
                }
                className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
              />
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <label className="flex items-center justify-between rounded-xl bg-rose-50/70 px-3 py-2.5 text-[11px] font-semibold text-[#617F91]">
            <span>
              头像奶油花边框
              <span className="mt-0.5 block text-[9px] font-normal text-slate-400">开启后显示浅粉色花边；关闭则使用无边框头像。</span>
            </span>
            <input
              type="checkbox"
              checked={draft.avatarFrameEnabled ?? false}
              onChange={(event) => {
                setDraft((current) => ({ ...current, avatarFrameEnabled: event.target.checked }));
                setStatus('');
                setError('');
              }}
              className="accent-pink-400"
            />
          </label>
          <label className="block text-[11px] font-semibold text-[#2C4A5C]">
            头像图片链接
            <input
              type="url"
              value={draft.avatarUrl ?? ''}
              onChange={(event) => updateField('avatarUrl', event.target.value)}
              placeholder="留空则显示昵称首字"
              className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
            />
          </label>
          {fileInput('avatarUrl', '头像')}
          <label className="block text-[11px] font-semibold text-[#2C4A5C]">
            资料卡背景图片链接
            <input
              type="url"
              value={draft.coverImageUrl ?? ''}
              onChange={(event) => updateField('coverImageUrl', event.target.value)}
              placeholder="留空则显示渐变背景"
              className="mt-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
            />
          </label>
          {fileInput('coverImageUrl', '资料卡背景')}
        </div>

        {isProcessingImage && <p className="text-[11px] text-sky-700">正在压缩图片…</p>}
        {status && <p role="status" className="text-[11px] text-emerald-700">{status}</p>}
        {error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={isProcessingImage}
          className="w-full rounded-xl bg-sky-600 text-white py-2.5 text-xs font-bold disabled:opacity-50"
        >
          保存资料
        </button>
      </section>
    </div>
  );
};
