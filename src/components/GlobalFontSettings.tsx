import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Type } from 'lucide-react';
import { DEFAULT_FONT_SETTINGS, FONT_FAMILIES, type FontSettings, normalizeFontUrl, readFontFile } from '../utils/fontSettings';
import { setStorageItemsAtomically } from '../utils/dbStorage';
import { SETTINGS_KEYS } from '../utils/settings';

export function GlobalFontSettings({ fontSettings, onSaveFontSettings }: {
  fontSettings: FontSettings; onSaveFontSettings: (settings: FontSettings) => boolean;
}) {
  const [fontUrlDraft, setFontUrlDraft] = useState(fontSettings.url ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => setFontUrlDraft(fontSettings.url ?? ''), [fontSettings.url]);
  const save = (settings: FontSettings) => {
    const saved = onSaveFontSettings(settings);
    if (saved) setError('');
    return saved;
  };
  return <>
        <details className="glass-card group rounded-2xl p-3 space-y-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-[#2C4A5C]">
            <Type className="h-3.5 w-3.5 shrink-0 text-sky-500" /><span className="flex-1">全局字体</span>
            <ChevronDown size={13} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <fieldset disabled={busy} className="min-w-0 space-y-3">
          <p className="text-[11px] text-slate-500">应用于主页与所有 App。字体样式取决于设备已安装字体，聊天单独字号在此基础上缩放。</p>
          <label className="block text-xs text-[#2C4A5C]">
            字体大小 · {Math.round(fontSettings.scale * 100)}%
            <input
              aria-label="全局字体大小"
              type="range"
              min={85}
              max={130}
              step={5}
              value={Math.round(fontSettings.scale * 100)}
              onChange={(event) => {
                if (!save({ ...fontSettings, scale: Number(event.target.value) / 100 })) {
                  setError('全局字体保存失败，请重试。');
                }
              }}
              className="mt-2 w-full"
            />
          </label>
          <label className="block cursor-pointer rounded-xl border border-white bg-white/70 px-3 py-2 text-center text-xs font-semibold text-sky-700">{busy ? '正在导入字体…' : '导入字体文件'}<input type="file" aria-label="导入字体文件" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" className="hidden" onChange={event => {
            const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
            setBusy(true); setError('');
            void (async () => {
              try {
                const imported = await readFontFile(file);
                await new FontFace('YYphoneImportCheck', `url(${JSON.stringify(imported.dataUrl)})`).load();
                if (!alive.current) return;
                const next = { ...fontSettings, url: '', file: imported };
                // Font files can be much larger than ordinary settings. Await the
                // durable write so a storage failure leaves the current font intact.
                await setStorageItemsAtomically({ [SETTINGS_KEYS.font]: next });
                if (!onSaveFontSettings(next)) throw new Error('字体文件保存失败，请检查存储空间。');
                if (alive.current) { setError(''); setFontUrlDraft(''); }
              } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '字体文件无法加载。'); }
              finally { if (alive.current) setBusy(false); }
            })();
          }} /></label>
          <p className="text-[11px] text-slate-500">{fontSettings.file ? `已导入：${fontSettings.file.name}` : '支持 TTF、OTF、WOFF、WOFF2，最大 30 MB。导入后保存在本机，重新打开仍可使用。'}</p>
          <label className="block text-xs text-[#2C4A5C]">
            自定义字体 URL
            <input
              type="url"
              value={fontUrlDraft}
              onChange={(event) => setFontUrlDraft(event.target.value)}
              placeholder="https://example.com/font.woff2"
              className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2"
            />
          </label>
          <p className="text-[11px] text-slate-500">填写支持跨域的字体文件直链（WOFF2 / WOFF / TTF / OTF），不是字体介绍网页。留空并应用即可恢复所选内置字体。</p>
          <button type="button" className="text-xs font-semibold text-sky-600" onClick={() => {
            try {
              const url = normalizeFontUrl(fontUrlDraft);
              if (!save({ ...fontSettings, url, file: undefined })) throw new Error('字体链接保存失败。');
              setFontUrlDraft(url);
            } catch (error) {
              setError(error instanceof Error ? error.message : '无效的字体链接。');
            }
          }}>应用字体链接</button>
          <label className="block text-xs text-[#2C4A5C]">
            字体样式
            <select
              aria-label="全局字体样式"
              value={fontSettings.family}
              onChange={(event) => {
                const family = event.target.value;
                if (family !== 'system' && family !== 'serif' && family !== 'rounded') {
                  setError('无效的字体样式，请重新选择。');
                  return;
                }
                if (!save({ ...fontSettings, family })) setError('全局字体保存失败，请重试。');
              }}
              className="mt-1 w-full rounded-xl border border-white bg-white/70 px-3 py-2"
            >
              {Object.entries(FONT_FAMILIES).map(([id, font]) => <option key={id} value={id}>{font.label}</option>)}
            </select>
          </label>
          <p className="text-sm">预览：今天也要好好生活 Aa 123</p>
          <button type="button" className="text-xs font-semibold text-sky-600" onClick={() => {
            if (!save(DEFAULT_FONT_SETTINGS)) setError('全局字体恢复失败，请重试。');
            else setFontUrlDraft('');
          }}>恢复默认字体</button>
          </fieldset>
        </details>
{error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
</>;
}
