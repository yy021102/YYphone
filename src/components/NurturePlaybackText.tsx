import { createContext, useContext, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';

export type PlaybackTextHandle = { isReady: () => boolean };
type PlaybackTextState = { paused: boolean; revealers: Set<() => boolean>; barriers: Set<symbol> };
const Context = createContext<PlaybackTextState | null>(null);
export const DIALOG_HOLD_MS = 5000;
export function thoughtPlaybackMs(text: string, delay = 160) {
  return text.length ? delay + Math.min(4000, Array.from(text).length * 24) + DIALOG_HOLD_MS : 0;
}

export function NurturePlaybackText({ paused, presentationRef, children }: { paused: boolean; presentationRef?: Ref<PlaybackTextHandle>; children: ReactNode }) {
  const [state] = useState<PlaybackTextState>(() => ({ paused, revealers: new Set(), barriers: new Set() }));
  useImperativeHandle(presentationRef, () => ({ isReady: () => state.barriers.size === 0 && ![...state.revealers].some(reveal => reveal()) }), [state]);
  return <Context.Provider value={{ ...state, paused }}>{children}</Context.Provider>;
}
export function usePlaybackBarrier(blocked: boolean) {
  const context = useContext(Context), barriers = context?.barriers;
  useEffect(() => {
    if (!blocked || !barriers) return;
    const id = Symbol(); barriers.add(id);
    return () => { barriers.delete(id); };
  }, [blocked, barriers]);
}
export function usePlaybackTextState() { return useContext(Context); }
export function typewriterCount(text: string, elapsed: number, delay = 0) {
  const length = Array.from(text).length;
  // Short monologues take roughly a second; long legacy text never takes more than 4s.
  const perCharacter = Math.min(24, 4000 / Math.max(1, length));
  return Math.max(0, Math.min(length, Math.floor((elapsed - delay) / perCharacter)));
}
export function NurtureThought({ text, delay = 160 }: { text: string; delay?: number }) {
  return <ThoughtText key={text} text={text} delay={delay}/>;
}
function ThoughtText({ text, delay }: { text: string; delay: number }) {
  const context = useContext(Context), revealers = context?.revealers;
  const [elapsed, setElapsed] = useState(0), accumulated = useRef(0);
  const letters = Array.from(text), count = typewriterCount(text, elapsed, delay), complete = count >= letters.length;
  const settled = elapsed >= thoughtPlaybackMs(text, delay);
  const pending = useRef(!settled); pending.current = !settled;
  useEffect(() => {
    if (!revealers) return;
    const reveal = () => pending.current;
    revealers.add(reveal); return () => { revealers.delete(reveal); };
  }, [revealers]);
  useEffect(() => {
    if (!context || context.paused || settled) return;
    const started = performance.now();
    const timer = window.setInterval(() => setElapsed(accumulated.current + performance.now() - started), 24);
    return () => { accumulated.current += performance.now() - started; window.clearInterval(timer); };
  }, [!!context, context?.paused, settled]);
  return <span className="nurture-typewriter" data-typing={!!context && !complete || undefined} aria-label={text}><span aria-hidden="true">{!context || complete ? text : letters.slice(0, count).join('')}{context && !complete && <i className="nurture-typewriter-caret"/>}</span></span>;
}
