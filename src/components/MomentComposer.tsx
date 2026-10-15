import React, { useRef, useState } from 'react';
import { ImagePlus, Link2, Plus, Type, X } from 'lucide-react';
import { compressImageFile } from '../utils/imageFile';
import { MAX_MOMENT_MEDIA, MomentPost, MomentVisibilityRule } from '../utils/momentsData';
import { TextImageCard } from './MomentCards';

export interface MomentComposerResult {
  content: string;
  images: string[];
  textImageCards: string[];
  location: string;
  visibilityRule?: MomentVisibilityRule;
}

interface MomentComposerProps {
  initial?: MomentPost;
  contacts: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: (result: MomentComposerResult) => void;
}

const VISIBILITY_OPTIONS = [
  ['all', '所有角色可见'],
  ['selected', '部分可见'],
  ['exclude', '不给谁看'],
] as const;

export const MomentComposer: React.FC<MomentComposerProps> = ({ initial, contacts, onClose, onSubmit }) => {
  const [content, setContent] = useState(initial?.content ?? '');
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [cards, setCards] = useState<string[]>(initial?.textImageCards ?? []);
  const [location, setLocation] = useState(initial?.location ?? '');
  const [visibilityType, setVisibilityType] = useState<MomentVisibilityRule['type']>(
    initial?.visibilityRule?.type ?? 'all'
  );
  const [targetIds, setTargetIds] = useState<string[]>(initial?.visibilityRule?.targetIds ?? []);
  const [urlDraft, setUrlDraft] = useState('');
  const [cardDraft, setCardDraft] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mediaCount = images.length + cards.length;
  const isFull = mediaCount >= MAX_MOMENT_MEDIA;

  const addImageUrl = () => {
    const url = urlDraft.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError('请输入 http(s) 开头的图片链接。');
      return;
    }
    if (isFull) {
      setError(`最多添加 ${MAX_MOMENT_MEDIA} 张图片/文字图。`);
      return;
    }
    setImages((current) => [...current, url]);
    setUrlDraft('');
    setError('');
  };

  const addCard = () => {
    const text = cardDraft.trim();
    if (!text) return;
    if (isFull) {
      setError(`最多添加 ${MAX_MOMENT_MEDIA} 张图片/文字图。`);
      return;
    }
    setCards((current) => [...current, text.slice(0, 120)]);
    setCardDraft('');
    setError('');
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const room = MAX_MOMENT_MEDIA - mediaCount;
      const added: string[] = [];
      for (const file of Array.from(files).slice(0, Math.max(room, 0))) {
        added.push(await compressImageFile(file, { maxDimension: 720, maxBytes: 160 * 1024 }));
      }
      setImages((current) => [...current, ...added]);
      setError(files.length > room ? `最多添加 ${MAX_MOMENT_MEDIA} 张图片/文字图，多余的已忽略。` : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片处理失败。');
    } finally {
      setUploading(false);
    }
  };

  const toggleTarget = (id: string) =>
    setTargetIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const submit = () => {
    if (!content.trim() && mediaCount === 0) {
      setError('写点文字，或添加图片/文字图后再发布。');
      return;
    }
    if (visibilityType === 'selected' && targetIds.length === 0) {
      setError('请选择谁可以看，或改为“所有角色可见”。');
      return;
    }
    onSubmit({
      content: content.trim(),
      images,
      textImageCards: cards,
      location: location.trim(),
      ...(visibilityType !== 'all' ? { visibilityRule: { type: visibilityType, targetIds } } : {}),
    });
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={initial ? '编辑朋友圈' : '我要发圈'}
        className="w-full max-w-sm max-h-[92%] overflow-y-auto rounded-3xl bg-white/95 p-4 shadow-2xl space-y-3 text-slate-700"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#2C4A5C]">{initial ? '编辑朋友圈' : '我要发圈'}</h2>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={600}
          rows={4}
          placeholder="这一刻的想法…"
          aria-label="朋友圈正文"
          className="w-full resize-none rounded-xl bg-sky-50/60 border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400"
        />

        {mediaCount > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((src, index) => (
              <div key={`img-${index}`} className="relative aspect-square overflow-hidden rounded-lg">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="移除图片"
                  onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {cards.map((text, index) => (
              <div key={`card-${index}`} className="relative aspect-square">
                <TextImageCard text={text} />
                <button
                  type="button"
                  aria-label="移除文字图"
                  onClick={() => setCards((current) => current.filter((_, i) => i !== index))}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <section className="space-y-2 rounded-2xl bg-sky-50/60 border border-white/80 p-3">
          <p className="text-xs font-bold text-[#2C4A5C]">文字图（选填）</p>
          <div className="flex gap-2">
            <input
              value={cardDraft}
              onChange={(event) => setCardDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') addCard(); }}
              maxLength={120}
              placeholder="输入画面描述或心情文字"
              aria-label="文字图内容"
              className="min-w-0 flex-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400"
            />
            <button
              type="button"
              onClick={addCard}
              disabled={!cardDraft.trim()}
              className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-sky-400 to-pink-400 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40 cursor-pointer"
            >
              <Type className="w-3 h-3" />添加
            </button>
          </div>
          <p className="text-xs font-bold text-[#2C4A5C] pt-1">真实图片（选填）</p>
          <div className="flex gap-2">
            <input
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') addImageUrl(); }}
              placeholder="图床链接 https://..."
              aria-label="图片链接"
              className="min-w-0 flex-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400"
            />
            <button
              type="button"
              onClick={addImageUrl}
              disabled={!urlDraft.trim()}
              className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-white border border-sky-200 px-3 py-2 text-[11px] font-bold text-sky-600 disabled:opacity-40 cursor-pointer"
            >
              <Link2 className="w-3 h-3" />添加
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-dashed border-sky-300 px-3 py-2 text-xs font-bold text-sky-600 disabled:opacity-50 cursor-pointer"
          >
            <ImagePlus className="w-3.5 h-3.5" />{uploading ? '正在处理…' : '从相册选择'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
        </section>

        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          maxLength={40}
          placeholder="所在位置（选填）"
          aria-label="定位"
          className="w-full rounded-xl bg-slate-100/80 border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400"
        />

        <section className="space-y-2 rounded-2xl bg-pink-50/50 border border-white/80 p-3">
          <p className="text-xs font-bold text-[#2C4A5C]">谁可以看</p>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/80 p-1">
            {VISIBILITY_OPTIONS.map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => setVisibilityType(type)}
                className={`rounded-lg py-1.5 text-[11px] font-bold cursor-pointer ${
                  visibilityType === type ? 'bg-gradient-to-r from-sky-200 to-pink-200 text-[#2C4A5C]' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {visibilityType !== 'all' && (
            <div className="max-h-28 space-y-1 overflow-y-auto rounded-xl bg-white p-2">
              {contacts.length === 0 && <p className="text-[11px] text-slate-400">通讯录里还没有角色。</p>}
              {contacts.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={targetIds.includes(contact.id)}
                    onChange={() => toggleTarget(contact.id)}
                  />
                  {contact.name}
                </label>
              ))}
            </div>
          )}
        </section>

        {error && <p role="alert" className="text-[11px] font-bold text-rose-500">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={uploading}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-pink-400 py-2.5 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />{initial ? '保存修改' : '发布'}
        </button>
      </section>
    </div>
  );
};
