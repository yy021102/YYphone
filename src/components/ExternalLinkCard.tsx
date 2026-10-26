import { useEffect, useState } from 'react';
import { ExternalLink, Link as LinkIcon } from 'lucide-react';
import { fallbackLinkPreview, fetchLinkPreview, type LinkPreview } from '../utils/linkPreview';

export function ExternalLinkCard({ url, text, saved, onResolved, disabled }: { url: string; text: string; saved?: Partial<LinkPreview> & { loaded?: boolean }; onResolved: (preview: LinkPreview) => void; disabled?: boolean }) {
  const fallback = fallbackLinkPreview(url, text);
  const [preview, setPreview] = useState<LinkPreview>({ ...fallback, ...saved, url });
  const [failedImage, setFailedImage] = useState(false);
  const caption = text.replace(/(?:https?:\/\/|www\.)[^\s<>"“”]+/gi, '').trim();
  useEffect(() => {
    let alive = true;
    if (!saved?.loaded) void fetchLinkPreview(url).then(data => {
      if (!alive) return;
      const next = { ...data, title: data.title || fallback.title }; setPreview(next); onResolved(next);
    }).catch(() => {});
    return () => { alive = false; };
  }, [url]);
  return <div className="yy-external-link-share">{caption && caption !== preview.title && <p className="yy-link-share-caption">{caption}</p>}<a className="yy-external-link-card" href={disabled ? undefined : url} target="_blank" rel="noopener noreferrer" onClick={event => { if (!disabled) event.stopPropagation(); else event.preventDefault(); }} aria-label={`打开${preview.source}链接：${preview.title}`}>
    <div className="yy-link-card-main"><div><strong>{preview.title}</strong>{preview.description && <p>{preview.description}</p>}</div>{preview.image && !failedImage ? <img src={preview.image} alt="" referrerPolicy="no-referrer" onError={() => setFailedImage(true)} /> : <span className="yy-link-card-placeholder"><LinkIcon size={25} strokeWidth={1.4} /></span>}</div>
    <footer><span>{preview.source}</span><ExternalLink size={11} /></footer>
  </a></div>;
}
