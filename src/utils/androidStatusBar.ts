/** Android browser chrome accepts a color, not a wallpaper. Leave iOS tinting untouched. */
export function installAndroidStatusBar(root: HTMLElement): () => void {
  if (!/Android/i.test(navigator.userAgent)) return () => {};
  const meta = document.createElement('meta');
  meta.name = 'theme-color'; meta.dataset.yyphoneAndroid = ''; meta.content = '#edf3fa';
  document.head.append(meta);
  let frame = 0, revision = 0, disposed = false;
  let imageCache: { url: string; color: string } | undefined;
  const colorToken = (value: string) => value.match(/#[a-f\d]{3,8}\b|rgba?\([^)]*\)/i)?.[0];
  const visibleColor = (value: string) => value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)' ? value : undefined;
  const sample = async (element: Element, background: string): Promise<string | undefined> => {
    const url = background.match(/url\(["']?(data:image\/[^"')]+|blob:[^"')]+)["']?\)/i)?.[1];
    if (!url) return undefined;
    const rect = element.getBoundingClientRect();
    const cacheKey = `${rect.width}:${rect.height}:${url}`;
    if (imageCache?.url === cacheKey) return imageCache.color;
    try {
      const image = new Image(); image.src = url; await image.decode();
      const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      if (!Number.isFinite(scale) || scale <= 0) return undefined;
      const canvas = document.createElement('canvas'); canvas.width = 12; canvas.height = 1;
      const ctx = canvas.getContext('2d'); if (!ctx) return undefined;
      const sourceWidth = rect.width / scale, sourceHeight = rect.height / scale;
      ctx.drawImage(image, Math.max(0, (image.naturalWidth - sourceWidth) / 2), Math.max(0, (image.naturalHeight - sourceHeight) / 2), sourceWidth, Math.max(1, sourceHeight / Math.max(1, rect.height)), 0, 0, 12, 1);
      const pixels = ctx.getImageData(0, 0, 12, 1).data;
      const sums = [0, 0, 0]; for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) sums[c] += pixels[i + c] * pixels[i + 3] / 255 + 255 - pixels[i + 3];
      const color = `rgb(${sums.map(n => Math.round(n / 12)).join(', ')})`;
      imageCache = { url: cacheKey, color }; return color;
    } catch { return undefined; }
  };
  const sync = async () => {
    frame = 0; const current = ++revision;
    const stack = document.elementsFromPoint(window.innerWidth / 2, 1);
    let color: string | undefined;
    for (const element of stack) {
      const style = getComputedStyle(element);
      if (Number(style.opacity) === 0) continue;
      if (style.backgroundImage !== 'none') {
        color = await sample(element, style.backgroundImage) || colorToken(style.backgroundImage);
        if (color) break;
      }
      color = visibleColor(style.backgroundColor);
      if (color) break;
    }
    if (!disposed && current === revision && color) meta.content = color;
  };
  const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(() => { void sync(); }); };
  const observer = new MutationObserver(schedule);
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-home-style', 'data-home-page'] });
  observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-follow-system-dark'] });
  window.addEventListener('resize', schedule); window.addEventListener('pageshow', schedule); schedule();
  return () => { disposed = true; revision++; cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule); window.removeEventListener('pageshow', schedule); meta.remove(); };
}
