import React, { useRef, useState } from 'react';
import { ImagePlus, RotateCcw } from 'lucide-react';
import { imageFileToDataUrl, validateImageUrl } from '../utils/widgetAppearance';

interface ImagePickerProps {
  label: string;
  value: string;
  square?: boolean;
  round?: boolean;
  maxSize: number;
  onChange: (value: string) => void;
}

export const WidgetImagePicker: React.FC<ImagePickerProps> = ({ label, value, square, round, maxSize, onChange }) => {
  const [urlDraft, setUrlDraft] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const applyUrl = () => {
    try {
      onChange(validateImageUrl(urlDraft));
      setUrlDraft('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '链接无效。');
    }
  };

  const applyFile = async (file?: File) => {
    if (!file) return;
    try {
      onChange(await imageFileToDataUrl(file, { maxSize, square }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片无法处理。');
    }
  };

  return (
    <section className="space-y-2 rounded-2xl bg-sky-50/60 border border-white/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#2C4A5C]">{label}</span>
        <button
          type="button"
          onClick={() => { onChange(''); setError(''); }}
          disabled={!value}
          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 disabled:opacity-40 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />恢复默认
        </button>
      </div>
      {value && (
        <div
          aria-label={`${label}预览`}
          className={`h-14 border border-white bg-cover bg-center shadow-sm ${round ? 'w-14 rounded-full' : 'w-full rounded-xl'}`}
          style={{ backgroundImage: `url("${value}")` }}
        />
      )}
      <div className="flex gap-2">
        <input
          value={urlDraft}
          onChange={(event) => setUrlDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') applyUrl(); }}
          placeholder="粘贴图片链接 https://..."
          aria-label={`${label}链接`}
          className="min-w-0 flex-1 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400"
        />
        <button
          type="button"
          onClick={applyUrl}
          disabled={!urlDraft.trim()}
          className="shrink-0 rounded-xl bg-gradient-to-r from-sky-400 to-pink-400 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40 cursor-pointer"
        >
          使用
        </button>
      </div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-dashed border-sky-300 px-3 py-2 text-xs font-bold text-sky-600 cursor-pointer"
      >
        <ImagePlus className="w-3.5 h-3.5" />选择本地图片
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void applyFile(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      {error && <p role="alert" className="text-[11px] font-bold text-rose-500">{error}</p>}
    </section>
  );
};
