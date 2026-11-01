// Keeps the app sized to the visible viewport so the on-screen keyboard shrinks the
// layout (headers stay pinned) instead of panning the whole page upward.
export function initViewportKeyboardLayout(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const root = document.documentElement;
  let frame = 0;

  const apply = () => {
    frame = 0;
    root.style.setProperty('--app-height', `${Math.round(viewport.height)}px`);
    root.style.setProperty('--app-top', `${Math.round(viewport.offsetTop)}px`);
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };

  viewport.addEventListener('resize', schedule);
  viewport.addEventListener('scroll', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule);
  apply();
}
