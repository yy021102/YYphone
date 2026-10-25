import React, { useEffect, useState } from 'react';
import { DEFAULT_FONT_SETTINGS, FONT_FAMILIES, type FontSettings, normalizeFontUrl } from '../utils/fontSettings';

export function GlobalFontSettings({ fontSettings, onSaveFontSettings }: {
  fontSettings: FontSettings; onSaveFontSettings: (settings: FontSettings) => boolean;
}) {
  const [fontUrlDraft, setFontUrlDraft] = useState(fontSettings.url ?? '');
  const [error, setError] = useState('');
  useEffect(() => setFontUrlDraft(fontSettings.url ?? ''), [fontSettings.url]);
  const save = (settings: FontSettings) => {
    const saved = onSaveFontSettings(settings);
    if (saved) setError('');
    return saved;
  };
  return <>
        <section className="glass-card rounded-2xl p-4 space-y-3">
          <h2 className="text-xs font-bold text-[#2C4A5C]">全局字体</h2>
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
              if (!save({ ...fontSettings, url })) throw new Error('字体链接保存失败。');
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
        </section>
{error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
</>;
}
