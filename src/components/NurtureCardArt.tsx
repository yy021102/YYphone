import { useEffect, useRef, useState } from 'react';
import type { Card } from '../utils/nurture';
import { compressImage } from '../utils/imageFile';

export function NurtureCardArt({ card }: { card: Card }) {
  const image = card.artType !== 'text' && card.image;
  return image ? <img className="nurture-card-image" src={image} alt={card.name}/> : <div className="nurture-text-art"><small>{card.rarity} · POCKET OF YOU</small><span>✦</span><strong>{card.name}</strong><p>{card.artText || card.description || '将这一刻，藏进心里。'}</p><span>✧</span></div>;
}
export function NurtureCardArtEditor({ card, onChange, onBusy }: { card: Card; onChange: (patch: Partial<Card>) => void; onBusy: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const type = card.artType ?? (card.image ? 'image' : 'text');
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); onBusy(true); setError('');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('请选择20MB以内的图片。');
      const image = await compressImage(file, { maxDimension: 1200, maxBytes: 500 * 1024, preserveTransparency: true });
      if (alive.current) onChange({ image, artType: 'image' });
    } catch(e) { if (alive.current) setError(e instanceof Error ? e.message : '上传失败'); }
    finally { onBusy(false); if (alive.current) setBusy(false); }
  };
  return <fieldset disabled={busy} className="nurture-art-editor"><legend>卡面样式</legend><label>卡面类型<select value={type} onChange={e => onChange({ artType: e.target.value as 'text' | 'image' })}><option value="text">文字卡面</option><option value="image">图片卡面</option></select></label>
    {type === 'text' ? <label>卡面文字<textarea maxLength={1500} value={card.artText ?? ''} onChange={e => onChange({ artText: e.target.value })} placeholder="写在卡面上的文字，支持换行；留空使用卡面描述。"/></label> : <><label className="nurture-upload">{busy ? '正在处理…' : '上传卡面图片'}<input type="file" accept="image/*" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }}/></label><label>图片链接<input type="url" value={card.image.startsWith('data:') ? '' : card.image} onChange={e => onChange({ image: e.target.value })} placeholder={card.image.startsWith('data:') ? '已使用上传图片，填链接可替换' : 'https://…'}/></label></>}
    <div className="nurture-art-preview"><NurtureCardArt card={{ ...card, artType: type }}/></div>{error && <p role="alert" className="nurture-error">{error}</p>}
  </fieldset>;
}
