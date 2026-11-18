import { useEffect, useState } from 'react';

export function parseNurtureNumber(text: string) {
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim()) ? Number(text) : NaN;
}
/** Keep intermediate text such as '-' while the user types a signed number. */
export function NurtureNumberInput({ value, onChange, min, max }: { value: number; onChange: (value: number) => void; min: number; max: number }) {
  const [text, setText] = useState(() => Number.isFinite(value) ? String(value) : '');
  useEffect(() => {
    setText(previous => Number.isNaN(value) || Object.is(parseNurtureNumber(previous), value) ? previous : String(value));
  }, [value]);
  const invalid = !Number.isFinite(value) || value < min || value > max;
  return <input required type="text" inputMode="text" role="spinbutton" aria-valuemin={min} aria-valuemax={max} aria-valuenow={Number.isFinite(value) ? value : undefined} aria-invalid={invalid || undefined} maxLength={32} value={text} onChange={e => { setText(e.target.value); onChange(parseNurtureNumber(e.target.value)); }}/>;
}
