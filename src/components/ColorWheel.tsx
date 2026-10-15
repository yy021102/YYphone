import React, { useEffect, useRef, useState } from 'react';

interface ColorWheelProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const hexToRgb = (hex: string): [number, number, number] => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const value = match ? match[1] : 'ffffff';
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)) as [number, number, number];
};

export const hexToRgba = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha)})`;
};

const rgbToHsv = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const delta = max - Math.min(rn, gn, bn);
  let hue = 0;
  if (delta) {
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
  }
  return [(hue * 60 + 360) % 360, max ? delta / max : 0, max];
};

const hsvToHex = (hue: number, saturation: number, value: number) => {
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - chroma;
  const [r, g, b] =
    hue < 60 ? [chroma, x, 0] :
    hue < 120 ? [x, chroma, 0] :
    hue < 180 ? [0, chroma, x] :
    hue < 240 ? [0, x, chroma] :
    hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`;
};

const SWATCHES = ['#f1f3f6', '#e3e6eb', '#ffffff', '#fde2ec', '#dbeafe', '#e0f2fe', '#ede9fe', '#d1fae5', '#fef3c7'];

export const ColorWheel: React.FC<ColorWheelProps> = ({ value, onChange, label }) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState(() => rgbToHsv(...hexToRgb(value)));
  const [hexDraft, setHexDraft] = useState(value);

  // 外部值（如恢复默认）变化时同步；自身产生的变化不会改写色相，避免灰色时色相跳回 0。
  useEffect(() => {
    if (hsvToHex(...hsv) !== value.toLowerCase()) setHsv(rgbToHsv(...hexToRgb(value)));
    setHexDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next: [number, number, number]) => {
    setHsv(next);
    onChange(hsvToHex(...next));
  };

  const pickFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = wheelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const radius = rect.width / 2;
    const dx = event.clientX - rect.left - radius;
    const dy = event.clientY - rect.top - radius;
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    commit([hue, clamp(Math.hypot(dx, dy) / radius), hsv[2] || 1]);
  };

  const [hue, saturation, brightness] = hsv;
  const markerAngle = hue * Math.PI / 180;

  return (
    <div className="space-y-2" aria-label={label}>
      <div className="flex items-center gap-3">
        <div
          ref={wheelRef}
          role="slider"
          aria-label={`${label}色轮`}
          aria-valuenow={Math.round(hue)}
          aria-valuemin={0}
          aria-valuemax={360}
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            pickFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) pickFromPointer(event);
          }}
          className="relative h-[120px] w-[120px] shrink-0 cursor-crosshair touch-none rounded-full shadow-inner"
          style={{
            background:
              'radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 100%), conic-gradient(from 90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            filter: `brightness(${0.4 + brightness * 0.6})`,
          }}
        >
          <span
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{
              left: `${50 + Math.cos(markerAngle) * saturation * 50}%`,
              top: `${50 + Math.sin(markerAngle) * saturation * 50}%`,
              backgroundColor: value,
            }}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <label className="block text-[10px] font-semibold text-slate-500">
            明暗
            <input
              type="range"
              min="40"
              max="100"
              value={Math.round(brightness * 100)}
              onChange={(event) => commit([hue, saturation, Number(event.target.value) / 100])}
              aria-label={`${label}明暗`}
              className="mt-1 w-full"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 shrink-0 rounded-lg border border-white shadow-sm" style={{ backgroundColor: value }} />
            <input
              value={hexDraft}
              onChange={(event) => {
                setHexDraft(event.target.value);
                if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value.toLowerCase());
              }}
              maxLength={7}
              aria-label={`${label}色值`}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] outline-none"
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`选择颜色 ${swatch}`}
            onClick={() => onChange(swatch)}
            className="h-5 w-5 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
    </div>
  );
};
