import { CalendarDays } from 'lucide-react';
import './coupleDateField.css';

/** Keep the native picker while avoiding its device-dependent intrinsic layout. */
export function CoupleDateField({ value, onChange, label = '记录日期' }: {
  value: string; onChange: (value: string) => void; label?: string;
}) {
  return <label className="couple-date-field">
    <span>{label}</span>
    <span className="couple-date-control">
      <span aria-hidden="true">{value ? value.replace(/-/g, ' / ') : '选择日期'}</span>
      <CalendarDays size={16} aria-hidden="true" />
      <input type="date" aria-label={label} value={value} onChange={event => onChange(event.target.value)} />
    </span>
  </label>;
}
