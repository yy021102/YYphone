import { useEffect, useRef, useState } from 'react';
import type { GameProduct } from '../utils/nurtureDesign';
import { emptyDelta } from '../utils/nurtureDesign';
import { STAT_LABELS, type Stats } from '../utils/nurture';
import { compressImage } from '../utils/imageFile';

export function NurtureProductEditor({ product, onChange, onBusy }: { product: GameProduct; onChange: (patch: Partial<GameProduct>) => void; onBusy: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); onBusy(true); setError('');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('请选择20MB以内的商品图片。');
      const image = await compressImage(file, { maxDimension: 1200, maxBytes: 500 * 1024, preserveTransparency: true });
      if (alive.current) onChange({ image });
    } catch(e) { if (alive.current) setError(e instanceof Error ? e.message : '上传失败'); }
    finally { onBusy(false); if (alive.current) setBusy(false); }
  };
  const effects = product.effects ?? emptyDelta();
  return <fieldset disabled={busy}><legend>商品展示与收到后的反应</legend><label className="nurture-upload">{busy ? '正在处理图片…' : '上传商品图片'}<input type="file" accept="image/*" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }}/></label><label>商品图片链接<input type="url" value={product.image?.startsWith('data:') ? '' : product.image ?? ''} onChange={e => onChange({ image: e.target.value })} placeholder={product.image?.startsWith('data:') ? '已上传图片，可填链接替换' : 'https://…'}/></label>{product.image && <img className="nurture-product-preview" src={product.image} alt={product.name}/>}
    <label>「我」收到后的反应（必填）<textarea required maxLength={1500} value={product.reaction ?? ''} onChange={e => onChange({ reaction: e.target.value })} placeholder="由你填写收到这件东西后的发言或反应，送出时原样播放。"/></label><p className="nurture-hint">购买只放入物品栏；角色送出后才播放反应。AI 只写角色的心理活动，不替你补写。</p>
    <label className="nurture-checkbox"><input type="checkbox" checked={product.effectsEnabled ?? false} onChange={e => onChange({ effectsEnabled: e.target.checked, effects })}/>收到后影响数值</label>
    {product.effectsEnabled && <div className="nurture-stat-fields">{(Object.keys(STAT_LABELS) as (keyof Stats)[]).map(k => <label key={k}>{STAT_LABELS[k]}变化<input required type="number" min={-15} max={15} value={effects[k]} onChange={e => onChange({ effects: { ...effects, [k]: e.target.valueAsNumber } })}/></label>)}</div>}
    {error && <p role="alert" className="nurture-error">{error}</p>}
  </fieldset>;
}
