/** Resolve only an exposed navigation action, never one behind another page or dialog. */
function visibleBack(root: HTMLElement): HTMLButtonElement | undefined {
  return [...root.querySelectorAll<HTMLButtonElement>('button[data-swipe-back],button[aria-label^="返回"],[role="dialog"] button[aria-label^="关闭"]')].reverse().find(button => {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true' || button.closest('[inert],[aria-hidden="true"]')) return false;
    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height || getComputedStyle(button).visibility !== 'visible') return false;
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return !!hit && button.contains(hit);
  });
}

function ownsHorizontalGesture(target: Element, root: HTMLElement): boolean {
  if (target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="slider"],canvas,video,audio,[data-no-swipe-back]')) return true;
  for (let node: Element | null = target; node && node !== root; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 4 && /^(auto|scroll)$/.test(getComputedStyle(node).overflowX)) return true;
  }
  return false;
}

/** Touch-only edge gesture: activate the same button as tapping Back, including its guards. */
export function installEdgeSwipeBack(root: HTMLElement, progress: (distance: number) => void): () => void {
  let gesture: { id: number; x: number; y: number; at: number; back: HTMLButtonElement; horizontal: boolean; threshold: number } | null = null;
  let suppressClickUntil = 0;
  const reset = () => { gesture = null; progress(0); };
  const start = (event: TouchEvent) => {
    reset();
    if (event.touches.length !== 1 || !(event.target instanceof Element)) return;
    const touch = event.touches[0], rect = root.getBoundingClientRect();
    if (touch.clientX < rect.left || touch.clientX - rect.left > 24 || ownsHorizontalGesture(event.target, root)) return;
    const back = visibleBack(root);
    if (back) gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, at: performance.now(), back,
      horizontal: false, threshold: Math.min(96, Math.max(64, rect.width * .22)) };
  };
  const move = (event: TouchEvent) => {
    if (!gesture) return;
    if (event.touches.length !== 1) { reset(); return; }
    const touch = [...event.touches].find(item => item.identifier === gesture!.id);
    if (!touch) { reset(); return; }
    const dx = touch.clientX - gesture.x, dy = Math.abs(touch.clientY - gesture.y);
    if (!gesture.horizontal) {
      if (dx < -12 || dy > 12 && dy > Math.abs(dx)) { reset(); return; }
      if (dx < 12 || dx < dy * 1.5) return;
      if (!event.cancelable) { reset(); return; }
      gesture.horizontal = true;
    }
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    progress(Math.max(.05, Math.min(1.3, dx / gesture.threshold)));
  };
  const end = (event: TouchEvent) => {
    const current = gesture;
    if (!current) return;
    const touch = [...event.changedTouches].find(item => item.identifier === current.id);
    reset();
    if (!current.horizontal || !touch) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    suppressClickUntil = performance.now() + 450;
    const dx = touch.clientX - current.x, dy = Math.abs(touch.clientY - current.y);
    if (!event.touches.length && dx >= current.threshold && dx > dy * 1.5 && performance.now() - current.at < 2000 &&
      current.back.isConnected && visibleBack(root) === current.back) current.back.click();
  };
  const click = (event: MouseEvent) => {
    if (event.detail && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  };
  root.addEventListener('touchstart', start, { capture: true, passive: true });
  root.addEventListener('touchmove', move, { capture: true, passive: false });
  root.addEventListener('touchend', end, { capture: true, passive: false });
  root.addEventListener('touchcancel', reset, true);
  root.addEventListener('click', click, true);
  return () => {
    root.removeEventListener('touchstart', start, true); root.removeEventListener('touchmove', move, true);
    root.removeEventListener('touchend', end, true); root.removeEventListener('touchcancel', reset, true);
    root.removeEventListener('click', click, true);
  };
}
