import { useRef, useState } from 'react';
import { clearAo3Data, exportAo3Data, importAo3Data, readAo3Settings, readAo3WorldBookIds, saveAo3GenerationSettings } from '../utils/ao3Settings';
import { readWorldBookOptions } from '../utils/worldBookPrompt';
export function Ao3Settings({ onChanged }: { onChanged: () => void }) {
  const [prompt, setPrompt] = useState(() => readAo3Settings().prompt);
  const [topPrompt, setTopPrompt] = useState(() => readAo3Settings().topPrompt || '');
  const [worldBookIds, setWorldBookIds] = useState(readAo3WorldBookIds);
  const books = readWorldBookOptions();
  const reloadSettings = () => { const settings = readAo3Settings(); setPrompt(settings.prompt); setTopPrompt(settings.topPrompt || ''); setWorldBookIds(readAo3WorldBookIds()); };
  const [status, setStatus] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = async (file?: File) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setError('备份超过 50MB，请检查文件。'); return; }
    if (!window.confirm('导入会替换当前 AO3 的作品、草稿、阅读记录和提示词，继续吗？')) return;
    setBusy(true); setError(''); setStatus('');
    try { await importAo3Data(JSON.parse(await file.text())); onChanged(); reloadSettings(); setStatus('已导入'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败，原数据已保留。'); }
    finally { setBusy(false); }
  };
  return <section className="ao3-editor"><h2>设置 <small>Preferences</small></h2>
    <fieldset disabled={busy}><legend>创作偏好</legend>
      <label>前置提示词<textarea aria-label="前置提示词" rows={6} maxLength={20000} value={topPrompt} placeholder="填写需要放在最前面的自定义提示词……" onChange={e => { setTopPrompt(e.target.value); setStatus(''); }}/></label>
      <p className="ao3-help">置于 AO3 生成提示词顶部。</p>
      <label>AO3 提示词<textarea aria-label="AO3 提示词" rows={10} maxLength={20000} value={prompt} placeholder="喜欢的文风、叙事节奏、评论区氛围、不想出现的内容……" onChange={e => { setPrompt(e.target.value); setStatus(''); }}/></label>
      <h3>绑定世界书</h3>
      <div className="ao3-world-books">{books.map(book => <label className="ao3-checkbox" key={book.id}><input type="checkbox" checked={worldBookIds.includes(book.id)} onChange={e => { setWorldBookIds(ids => e.target.checked ? [...new Set([...ids, book.id])] : ids.filter(id => id !== book.id)); setStatus(''); }}/><span>{book.name}{book.isGlobal ? '（全局）' : ''}</span></label>)}</div>
      <p className="ao3-help">{books.length ? '只读取勾选的世界书；全不选则不读取。' : '暂无世界书，可先在世界书 App 中添加。'}</p>
      <p className="ao3-help">角色作者优先使用角色设定的论坛名；未填时独立锁定首次笔名，不因删除作品而重置。笔名随 AO3 备份导入导出，清空 AO3 数据时一起清除。</p>
      <p className="ao3-help">用于新作品、续章和评论生成，保存后生效。</p><button className="ao3-button" onClick={() => { try { saveAo3GenerationSettings({ prompt, topPrompt, worldBookIds }); setStatus('已保存'); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); } }}>保存设置</button></fieldset>
    <fieldset disabled={busy}><legend>数据管理</legend><button className="ao3-button" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(exportAo3Data(), null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `AO3-${new Date().toISOString().slice(0, 10)}.json`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>导出数据</button><button className="ao3-button" onClick={() => input.current?.click()}>导入数据</button>
      <input ref={input} aria-label="导入 AO3 备份" type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void load(file); }}/>
      <button className="ao3-button" onClick={async () => {
        if (!window.confirm('清空 AO3 的全部作品、评论、草稿、阅读记录、提示词和锁定笔名？此操作无法撤销。')) return;
        setBusy(true); setError(''); setStatus('');
        try { await clearAo3Data(); onChanged(); reloadSettings(); setStatus('AO3 数据已清空'); }
        catch { setError('清空失败，请重试。'); } finally { setBusy(false); }
      }}>清空数据</button><p className="ao3-help">仅管理 AO3 文库，聊天中已分享的作品副本会保留。</p></fieldset>
    {status && <p role="status" className="ao3-notice">{status}</p>}{error && <p role="alert" className="ao3-notice ao3-error">{error}</p>}
  </section>;
}
