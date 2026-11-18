import { defaultPool, type PoolCampaign } from '../utils/nurturePool';

export function NurturePoolSettings({ value, onChange }: { value?: PoolCampaign; onChange: (value: PoolCampaign) => void }) {
  const pool = value ?? defaultPool();
  return <details className="nurture-editor-fold" open><summary>卡池上新与开放期限</summary><div><label>卡池名称<input maxLength={100} value={pool.name} onChange={e => onChange({ ...pool, name: e.target.value })}/></label><label>开放时间（留空立即开放）<input type="datetime-local" value={pool.startsAt} onChange={e => onChange({ ...pool, startsAt: e.target.value })}/></label><label>结束时间（留空长期开放）<input type="datetime-local" value={pool.endsAt} onChange={e => onChange({ ...pool, endsAt: e.target.value })}/></label><button type="button" className="nurture-add" onClick={() => onChange({ ...pool, updatedAt: new Date().toISOString() })}>标记本次上新</button>{pool.updatedAt && <p className="nurture-hint">上新时间：{new Date(pool.updatedAt).toLocaleString('zh-CN')}</p>}<p className="nurture-hint">新增卡面会在保存时标记上新。到期后停止整个卡池的抽取，已收藏的卡面和保底进度保留。</p></div></details>;
}
