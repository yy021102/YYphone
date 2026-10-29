import { useRef, useState, type PointerEvent } from 'react';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';

export const LITTLE_P_POSITION_KEY = 'yyphone:little-p-position';
interface Position { x: number; y: number }
const readPosition = () => readStoredValue<Position | null>(LITTLE_P_POSITION_KEY, null,
  (value): value is Position | null => value === null || !!value && typeof value === 'object' &&
    'x' in value && typeof value.x === 'number' && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1 &&
    'y' in value && typeof value.y === 'number' && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function LittlePGhost() {
  return <svg className="little-p-ghost-art" viewBox="0 0 64 76" fill="none" aria-hidden="true">
    <ellipse cx="32" cy="69" rx="19" ry="3" fill="#bda1cd" opacity=".25"/>
    <path d="M12 39V28C12 4 51 3 51 28v17q0 8 5 14l-9-2-5 7-9-4-7 6-7-6-10 3q6-10 3-24Z" fill="#f5ebed" stroke="#fff3dd" strokeWidth="1.2"/>
    <path d="M43 14q9 13 4 28-3 13-13 18l8 4 5-7 9 2q-5-6-5-14V28q0-10-8-14Z" fill="#d3c4df" opacity=".65"/>
    <path d="M15 38q-12 3-9-6m42 7q10-1 11-9" stroke="#f5ebed" strokeWidth="5" strokeLinecap="round"/>
    <ellipse cx="24" cy="29" rx="2.2" ry="3.5" fill="#655273"/><ellipse cx="39" cy="29" rx="2.2" ry="3.5" fill="#655273"/>
    <ellipse cx="19" cy="36" rx="4" ry="2.5" fill="#e8b4c9" opacity=".8"/><ellipse cx="44" cy="36" rx="4" ry="2.5" fill="#e8b4c9" opacity=".8"/>
    <path d="M28 37q4 5 8 0" stroke="#9d748f" strokeWidth="1.7" strokeLinecap="round"/>
    <path d="m48 3 1.6 4.5L54 9l-4.4 1.5L48 15l-1.5-4.5L42 9l4.5-1.5Z" fill="#f2d4a6"/>
    <text x="32" y="53" textAnchor="middle" fill="#ad8da9" fontSize="8" fontFamily="sans-serif" letterSpacing="1">小P</text>
  </svg>;
}

export function LittlePLauncher({ ghost = false, imageUrl, onOpen }: { ghost?: boolean; imageUrl?: string; onOpen: () => void }) {
  const [position, setPosition] = useState(readPosition), [dragging, setDragging] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; startX: number; startY: number; x: number; y: number; moved: boolean; previous: Position | null } | null>(null);
  const suppressClick = useRef(false), latest = useRef(position);
  latest.current = position;
  const cancel = () => {
    if (!gesture.current) return;
    setPosition(gesture.current.previous); latest.current = gesture.current.previous;
    gesture.current = null; setDragging(false);
  };
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || gesture.current || !zone.current) return;
    const bounds = zone.current.getBoundingClientRect(), button = event.currentTarget.getBoundingClientRect();
    suppressClick.current = false;
    gesture.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: button.left - bounds.left, y: button.top - bounds.top, moved: false, previous: position };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId || !zone.current) return;
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < 6) return;
    current.moved = true; setDragging(true);
    const bounds = zone.current.getBoundingClientRect(), button = event.currentTarget.getBoundingClientRect();
    const next = { x: clamp((current.x + dx) / Math.max(1, bounds.width - button.width)), y: clamp((current.y + dy) / Math.max(1, bounds.height - button.height)) };
    latest.current = next; setPosition(next);
  };
  const up = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null; setDragging(false); suppressClick.current = current.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.moved && latest.current) writeStoredValue(LITTLE_P_POSITION_KEY, latest.current);
  };
  return <div className="little-p-launcher-zone" ref={zone}>
    <button type="button" aria-label="打开小P" title="点击打开小P，拖动调整位置" className={`little-p-launcher${ghost ? ' is-ghost' : imageUrl ? ' has-custom-image' : ''}${dragging ? ' is-dragging' : ''}`}
      style={position ? { left: `${position.x * 100}%`, top: `${position.y * 100}%`, right: 'auto', bottom: 'auto', transform: `translate(${-position.x * 100}%, ${-position.y * 100}%)` } : undefined}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onClick={event => { if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; event.preventDefault(); return; } suppressClick.current = false; onOpen(); }}
      onDragStart={event => event.preventDefault()} onContextMenu={event => event.preventDefault()}>
      {ghost ? <LittlePGhost/> : imageUrl ? <img src={imageUrl} alt="" draggable={false}/> : <><span aria-hidden="true">✦</span><span>小P</span></>}
    </button>
  </div>;
}
