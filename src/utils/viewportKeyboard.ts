// Only constrain the app for an open keyboard; PWA safe areas must not shrink the full screen.
export function initViewportKeyboardLayout(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const root = document.documentElement;
  let frame = 0;

  const apply = () => {
    frame = 0;
    const active = document.activeElement;
    const editing = active instanceof HTMLTextAreaElement && !active.disabled && !active.readOnly ||
      active instanceof HTMLInputElement && !active.disabled && !active.readOnly &&
        ['text', 'search', 'email', 'password', 'tel', 'url', 'number'].includes(active.type) ||
      active instanceof HTMLElement && active.isContentEditable;
    const keyboardOpen = editing && viewport.scale === 1 && window.innerHeight - viewport.height > 120;
    if (keyboardOpen) {
      root.style.setProperty('--app-height', `${Math.ceil(viewport.height)}px`);
      root.style.setProperty('--app-top', `${Math.round(viewport.offsetTop)}px`);
    } else {
      root.style.removeProperty('--app-height');
      root.style.removeProperty('--app-top');
    }
    if (viewport.scale === 1 && (window.scrollX !== 0 || window.scrollY !== 0)) window.scrollTo(0, 0);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };

  viewport.addEventListener('resize', schedule);
  viewport.addEventListener('scroll', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  apply();
}
