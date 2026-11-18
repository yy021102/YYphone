import { useEffect, useRef, useState } from 'react';
import { Upload, Crosshair, Trash2 } from 'lucide-react';
import { BODY_PARTS, imagePoint, type BodyPart, type Portrait } from '../utils/nurtureGame';
import { compressImage } from '../utils/imageFile';

export function NurturePortraitEditor({ value, onChange, onBusy }: { value: Portrait; onChange: (value: Portrait) => void; onBusy: (busy: boolean) => void }) {
  const [selected, setSelected] = useState<BodyPart>('头');
  const [locating, setLocating] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState('');
  const uploadVersion = useRef(0), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // The file input is local to the planner; uploads never modify a different character.
  const upload = async (file?: File) => {
    if (!file) return;
    const version = ++uploadVersion.current;
    setUploading(true); onBusy(true); setError('');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('请选择 20MB 以内的图片。');
      const image = await compressImage(file, { maxDimension: 1600, maxBytes: 800 * 1024, preserveTransparency: true });
      if (alive.current && version === uploadVersion.current) { onChange({ ...value, image, points: {} }); setLocating(true); }
    } catch(e) { if (alive.current) setError(e instanceof Error ? e.message : '图片上传失败'); }
    finally { if (alive.current && version === uploadVersion.current) { setUploading(false); onBusy(false); } }
  };
  return <fieldset className="nurture-portrait-editor" disabled={uploading}><legend>立绘与触碰回应</legend><p className="nurture-hint">上传一张完整立绘，点击「定位部位」，选择部位后点击图片上的对应位置。更换图片需重新定位，原有发言会保留。</p>
    <label className="nurture-upload"><Upload size={16}/>{uploading ? '正在处理图片…' : value.image ? '更换立绘' : '上传立绘'}<input type="file" accept="image/*" disabled={uploading} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }}/></label>
    {value.image && <><button type="button" className="nurture-locate-toggle" aria-pressed={locating} onClick={() => setLocating(!locating)}><Crosshair size={16}/>{locating ? '完成定位' : '定位部位'}</button>
      <div className="nurture-part-picker">{BODY_PARTS.map(part => <button type="button" key={part} aria-pressed={selected === part} onClick={() => setSelected(part)}>{part}{value.points[part] ? ' ✓' : ''}</button>)}</div>
      <p className="nurture-hint" role="status">{locating ? `当前定位：${selected}。点击图片放置标记，可重复点击调整。` : `当前编辑：${selected}的触碰发言。已定位 ${Object.keys(value.points).length}/${BODY_PARTS.length} 个部位。`}</p>
      <div className={`nurture-editor-canvas${locating ? ' is-locating' : ''}`}><div className="nurture-image-plane"><img src={value.image} alt={`立绘，点击定位${selected}`} draggable={false} onClick={e => { if (locating && !uploading) onChange({ ...value, points: { ...value.points, [selected]: imagePoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()) } }); }}/>{BODY_PARTS.map(part => { const p = value.points[part]; return p && <button type="button" key={part} className={`nurture-body-marker${selected === part ? ' is-selected' : ''}`} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} onClick={() => setSelected(part)} aria-label={`已定位${part}，点击编辑发言`}>{part}</button>; })}</div></div>
      {value.points[selected] && <button type="button" onClick={() => { const points = { ...value.points }; delete points[selected]; onChange({ ...value, points }); }}><Trash2 size={14}/>清除{selected}的定位</button>}</>}
    {!value.image && <div className="nurture-part-picker">{BODY_PARTS.map(part => <button key={part} type="button" aria-pressed={selected === part} onClick={() => setSelected(part)}>{part}</button>)}</div>}
    <label>被触碰「{selected}」后的发言{value.points[selected] && '（必填）'}<textarea required={!!value.points[selected]} maxLength={1500} value={value.replies[selected] ?? ''} onChange={e => onChange({ ...value, replies: { ...value.replies, [selected]: e.target.value } })} placeholder="填写你被触碰后的原话，AI 不会代写。"/></label><p className="nurture-hint">每个已定位的部位都必须填写发言才能保存。未定位的部位不会提供给角色，也不能被触碰；发言只播放你的原文。</p>{error && <p role="alert" className="nurture-error">{error}</p>}
  </fieldset>;
}
