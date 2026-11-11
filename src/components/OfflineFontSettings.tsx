import { useEffect, useRef, useState } from 'react';
import { FONT_FAMILIES, readFontFile } from '../utils/fontSettings';
import { OFFLINE_STYLE_KEY, type OfflineStyle } from '../utils/offlineData';
import { setStorageItemsAtomically } from '../utils/dbStorage';

export function OfflineFontSettings({ value, onChange }: { value: OfflineStyle; onChange: (value: OfflineStyle) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return <fieldset disabled={busy} className="space-y-3 text-xs">
    <p className="text-[11px] text-slate-400">只调整线下剧情和我的气泡。</p>
    <label className="block space-y-1">字体样式<select aria-label="线下字体样式" value={value.fontFile ? 'file' : value.fontFamily ?? 'inherit'} onChange={event => { if (event.target.value !== 'file') onChange({ ...value, fontFamily: event.target.value as OfflineStyle['fontFamily'], fontFile: undefined }); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2">
      <option value="inherit">跟随全局字体</option>{Object.entries(FONT_FAMILIES).map(([id, font]) => <option key={id} value={id}>{font.label}</option>)}{value.fontFile && <option value="file">已导入：{value.fontFile.name}</option>}
    </select></label>
    <label className="block cursor-pointer rounded-xl border border-white bg-white/80 px-3 py-2 text-center font-semibold text-sky-700">{busy ? '正在导入…' : '上传字体文件'}<input type="file" aria-label="上传线下字体文件" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      setBusy(true); setError('');
      void (async () => {
        try {
          const imported = await readFontFile(file);
          await new FontFace('YYphoneOfflineCheck', `url(${JSON.stringify(imported.dataUrl)})`).load();
          if (!alive.current) return;
          const next = { ...value, fontFile: imported };
          await setStorageItemsAtomically({ [OFFLINE_STYLE_KEY]: next });
          if (alive.current) onChange(next);
        } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '字体无法加载，请检查文件。'); }
        finally { if (alive.current) setBusy(false); }
      })();
    }}/></label>
    <p className="text-[10px] text-slate-400">TTF、OTF、WOFF、WOFF2，最大 30 MB。</p>
    <label className="block space-y-1">字号 · {value.fontSize ? `${value.fontSize}px` : '默认'}<input aria-label="线下字号" type="range" min={10} max={30} step={1} value={value.fontSize ?? 13} onChange={event => onChange({ ...value, fontSize: Number(event.target.value) })} className="w-full"/></label>
    <label className="block space-y-1">行距 · {(value.lineHeight ?? 1.85).toFixed(2)}<input aria-label="线下行距" type="range" min={1.3} max={2.5} step={0.05} value={value.lineHeight ?? 1.85} onChange={event => onChange({ ...value, lineHeight: Number(event.target.value) })} className="w-full"/></label>
    <button type="button" className="text-sky-600" onClick={() => { onChange({ ...value, fontFamily: undefined, fontFile: undefined, fontSize: undefined, lineHeight: undefined }); setError(''); }}>恢复默认字体</button>
    {error && <p role="alert" className="text-rose-500">{error}</p>}
  </fieldset>;
}
