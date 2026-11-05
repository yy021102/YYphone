import { useEffect, useRef, useState } from 'react';
import { BookOpen, Square } from 'lucide-react';
import { AO3_RATINGS, type Ao3Work } from '../utils/ao3Data';
import { readAo3Characters } from '../utils/ao3Generation';
import { generateAo3Discovery, type Ao3DiscoveryOptions } from '../utils/ao3Discovery';

export function Ao3Discovery({ userName, onComplete, onCancel }: {
  userName: string; onComplete: (work: Ao3Work) => void; onCancel: () => void;
}) {
  const [characters] = useState(readAo3Characters);
  const [options, setOptions] = useState<Ao3DiscoveryOptions>({
    authorType: 'passerby', topic: characters.length ? 'couple' : 'fandom', charId: characters[0]?.id ?? '',
    fandom: '', direction: '', tone: '自由发挥', rating: 'Teen And Up Audiences', includeExperiences: true,
  });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const needsCharacter = options.authorType === 'character' || options.topic === 'couple';
  const change = (patch: Partial<Ao3DiscoveryOptions>) => { setOptions(old => ({ ...old, ...patch })); setError(''); };
  const stop = () => { request.current?.abort(); request.current = null; setBusy(false); };
  const generate = async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try {
      const work = await generateAo3Discovery(options, userName, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      onComplete(work);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '这次没能写好，请稍后再试。');
    } finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };
  return <section className="ao3-discovery"><h2>发现新作品 <small>New Stories</small></h2>
    <form onSubmit={e => { e.preventDefault(); void generate(); }}>
      <fieldset disabled={busy}><legend>谁在写</legend><div className="ao3-choice-grid">
        {([['passerby', '路人作者', '偶然点进一位太太的主页'], ['character', '角色作者', '藏在匿名笔名后的小心思']] as const).map(([value, title, subtitle]) =>
          <label className="ao3-choice" key={value}><input type="radio" name="ao3-author" value={value} checked={options.authorType === value} onChange={() => change({ authorType: value })}/><span><strong>{title}</strong><small>{subtitle}</small></span></label>)}
      </div></fieldset>
      <fieldset disabled={busy}><legend>想看什么</legend><div className="ao3-choice-grid">
        {([['fandom', '作品同人', '动漫、小说、游戏、影视…'], ['couple', '我们的同人', '你和角色，成为故事的主角']] as const).map(([value, title, subtitle]) =>
          <label className="ao3-choice" key={value}><input type="radio" name="ao3-topic" value={value} checked={options.topic === value} onChange={() => change({ topic: value })}/><span><strong>{title}</strong><small>{subtitle}</small></span></label>)}
      </div>
      {needsCharacter && <label>{options.topic === 'couple' ? 'CP 中的角色' : '写作的角色'}<select aria-label="创作角色" required value={options.charId} onChange={e => change({ charId: e.target.value })}><option value="">选择角色</option>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      {needsCharacter && !characters.length && <p className="ao3-help">先到微信通讯录添加一位角色，就能在这里遇见 TA。</p>}
      {options.authorType === 'character' && <p className="ao3-help">作者笔名优先使用角色设定的论坛名；未填写时锁定首次笔名，删除作品后也保留。作者回复沿用该作品署名。</p>}
      {options.topic === 'fandom' && <label>同人圈 / Fandom<input aria-label="生成作品同人圈" value={options.fandom} maxLength={200} placeholder="作品名称；留空随机选择" onChange={e => change({ fandom: e.target.value })}/></label>}
      <div className="ao3-form-row"><label>故事口味<select aria-label="故事口味" value={options.tone} onChange={e => change({ tone: e.target.value })}>{['自由发挥', '轻松甜饼', '日常慢热', '酸涩拉扯', '破镜重圆', '悬疑冒险', '平行世界 AU'].map(t => <option key={t}>{t}</option>)}</select></label>
        <label>分级<select aria-label="生成作品分级" value={options.rating} onChange={e => change({ rating: e.target.value as Ao3DiscoveryOptions['rating'] })}>{AO3_RATINGS.map(r => <option key={r}>{r}</option>)}</select></label></div>
      <label>内容方向<textarea aria-label="内容方向" rows={4} maxLength={8000} value={options.direction} placeholder={options.topic === 'couple' ? '想看的场景、关系、AU 或小心思；留空自由发挥' : '想看的 CP、情节、文风或不想出现的内容；留空自由发挥'} onChange={e => change({ direction: e.target.value })}/></label>
      {options.topic === 'couple' && <><label className="ao3-checkbox"><input type="checkbox" checked={options.includeExperiences} onChange={e => change({ includeExperiences: e.target.checked })}/>参考最近 150 条对话</label>
        {options.includeExperiences && <label>聊天剧情参考<select aria-label="聊天剧情参考" value={options.continuity ?? 'auto'} onChange={e => change({ continuity: e.target.value as Ao3DiscoveryOptions['continuity'] })}><option value="auto">按故事方向判断</option><option value="independent">只参考性格口吻，另写剧情</option><option value="current">承接当前剧情</option></select></label>}
        <p className="ao3-help">人设、世界书与对话补充始终参考。聊天用于补足性格和口吻，AU 不沿用原剧情。</p></>}
      </fieldset>
      {busy && <div className="ao3-writing-status" role="status"><BookOpen size={24}/><span>纸页上正落下一段故事<span className="ao3-writing-dots">…</span></span></div>}
      {error && <p className="ao3-notice ao3-error" role="alert">{error}</p>}
      <p className="ao3-help">使用当前 API，同时生成作品与五条评论，收进文库。</p>
      <div className="ao3-actions"><button type="button" className="ao3-button" onClick={onCancel}>返回</button>
        {busy ? <button key="stop" type="button" className="ao3-button" onClick={e => { e.preventDefault(); stop(); }}><Square size={12}/>停止生成</button> :
          <button key="generate" type="submit" className="ao3-button ao3-primary" disabled={needsCharacter && !options.charId}>生成作品</button>}</div>
    </form>
  </section>;
}
