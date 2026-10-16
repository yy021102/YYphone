import React, { useState } from 'react';
import { ColorWheel } from './ColorWheel';
import {
  AVATAR_FRAME_PRESETS,
  AvatarFrameStyle,
  DEFAULT_AVATAR_FRAME,
  frameGradient,
  normalizeAvatarFrame,
} from '../utils/avatarFrame';

interface AvatarFrameEditorProps {
  title: string;
  description?: string;
  value: AvatarFrameStyle | undefined;
  onChange: (next: AvatarFrameStyle) => void;
  previewUrl?: string;
  previewText?: string;
  /** 预览头像的圆角，要和实际显示处一致（例如 rounded-[38%]、rounded-xl） */
  radiusClass?: string;
}

/** 头像框编辑器：开关 + 渐变预设 + 自选两个颜色 + 角度 + 粗细，带实时预览。 */
export const AvatarFrameEditor: React.FC<AvatarFrameEditorProps> = ({
  title,
  description,
  value,
  onChange,
  previewUrl,
  previewText = '我',
  radiusClass = 'rounded-[38%]',
}) => {
  const frame = normalizeAvatarFrame(value);
  const [editing, setEditing] = useState<'color1' | 'color2'>('color1');
  const update = (patch: Partial<AvatarFrameStyle>) => onChange({ ...frame, ...patch });

  return (
    <div className="space-y-2.5 rounded-xl border border-white/80 bg-white/50 p-3">
      <label className="flex items-center justify-between text-[11px] font-semibold text-[#2C4A5C]">
        <span>
          {title}
          {description && <span className="mt-0.5 block text-[9px] font-normal text-slate-400">{description}</span>}
        </span>
        <input
          type="checkbox"
          checked={frame.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
          className="accent-pink-400"
        />
      </label>

      {frame.enabled && (
        <>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center ${radiusClass}`}
              style={{ background: frameGradient(frame), padding: `${frame.width}px` }}
            >
              <div className={`flex h-full w-full items-center justify-center overflow-hidden bg-white/90 text-sm font-bold text-[#587589] ${radiusClass}`}>
                {previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-cover" /> : previewText}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {AVATAR_FRAME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  title={preset.name}
                  aria-label={`套用${preset.name}渐变`}
                  onClick={() => update({ color1: preset.color1, color2: preset.color2 })}
                  className="h-6 w-6 rounded-full border border-white shadow-sm active:scale-90"
                  style={{ background: `linear-gradient(135deg, ${preset.color1}, ${preset.color2})` }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 text-[10px]">
            {(['color1', 'color2'] as const).map((key, index) => (
              <button
                key={key}
                type="button"
                onClick={() => setEditing(key)}
                className={`flex flex-1 items-center gap-1.5 rounded-lg border px-2 py-1.5 font-semibold ${editing === key ? 'border-pink-200 bg-white text-[#2C4A5C]' : 'border-white/80 bg-white/40 text-slate-400'}`}
              >
                <span className="h-4 w-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: frame[key] }} />
                颜色{index === 0 ? '一' : '二'}
              </button>
            ))}
          </div>
          <ColorWheel
            label={`${title}${editing === 'color1' ? '颜色一' : '颜色二'}`}
            value={frame[editing]}
            onChange={(hex) => update({ [editing]: hex })}
          />

          <label className="block text-[10px] font-semibold text-slate-500">
            渐变角度 {frame.angle}°
            <input type="range" min="0" max="360" value={frame.angle} onChange={(event) => update({ angle: Number(event.target.value) })} className="mt-1 w-full" />
          </label>
          <label className="block text-[10px] font-semibold text-slate-500">
            边框粗细 {frame.width}px
            <input type="range" min="1" max="8" value={frame.width} onChange={(event) => update({ width: Number(event.target.value) })} className="mt-1 w-full" />
          </label>
          <button type="button" onClick={() => onChange({ ...DEFAULT_AVATAR_FRAME, enabled: true })} className="text-[10px] text-slate-500 underline">
            恢复默认
          </button>
        </>
      )}
    </div>
  );
};
