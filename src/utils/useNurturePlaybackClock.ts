import { useEffect, useRef, useState } from 'react';

/** Components are keyed per operation, so pausing retains the current animation phase. */
export function useNurturePlaybackClock(paused = false) {
  const accumulated = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (paused) return;
    const started = performance.now();
    const timer = window.setInterval(() => setElapsed(accumulated.current + performance.now() - started), 100);
    return () => { accumulated.current += performance.now() - started; window.clearInterval(timer); };
  }, [paused]);
  return elapsed;
}
