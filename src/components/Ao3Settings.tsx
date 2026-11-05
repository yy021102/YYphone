import { useRef, useState } from 'react';
import { clearAo3Data, exportAo3Data, importAo3Data, readAo3Settings, saveAo3Prompt } from '../utils/ao3Settings';
export function Ao3Settings({ onChanged }: { onChanged: () => void }) {
  const [prompt, setPrompt] = useState(() => readAo3Settings().prompt);
  const [status, setStatus] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = async (file?: File) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setError('备份超过 50MB，请检查文件。'); return; }
    if (!window.confirm('导入会替换当前 AO3 的作品、草稿、阅读记录和提示词，继续吗？')) return;
    setBusy(true); setError(''); setStatus('');
    try { await importAo3Data(JSON.parse(await file.text())); onChanged(); setPrompt(readAo3Settings().prompt); setStatus('已导入'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败，原数据已保留。'); }
    finally { setBusy(false); }
  };
  return <section className="ao3-editor"><h2>设置 <small>Preferences</small></h2>
    <fieldset disabled={busy}><legend>创作偏好</legend><label>AO3 提示词<textarea aria-label="AO3 提示词" rows={10} maxLength={20000} value={prompt} placeholder="喜欢的文风、叙事节奏、评论区氛围、不想出现的内容……" onChange={e => { setPrompt(e.target.value); setStatus(''); }}/></label>
      <p className="ao3-help">角色作者优先使用角色设定的论坛名；未填时独立锁定首次笔名，不因删除作品而重置。笔名随 AO3 备份导入导出，清空 AO3 数据时一起清除。</p>
      <p className="ao3-help">用于新作品、续章和评论生成，保存后生效。</p><button className="ao3-button" onClick={() => { saveAo3Prompt(prompt); setStatus('已保存'); setError(''); }}>保存提示词</button></fieldset>
    <fieldset disabled={busy}><legend>数据管理</legend><button className="ao3-button" onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(exportAo3Data(), null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `AO3-${new Date().toISOString().slice(0, 10)}.json`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>导出数据</button><button className="ao3-button" onClick={() => input.current?.click()}>导入数据</button>
      <input ref={input} aria-label="导入 AO3 备份" type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void load(file); }}/>
      <button className="ao3-button" onClick={async () => {
        if (!window.confirm('清空 AO3 的全部作品、评论、草稿、阅读记录、提示词和锁定笔名？此操作无法撤销。')) return;
        setBusy(true); setError(''); setStatus('');
        try { await clearAo3Data(); onChanged(); setPrompt(''); setStatus('AO3 数据已清空'); }
        catch { setError('清空失败，请重试。'); } finally { setBusy(false); }
      }}>清空数据</button><p className="ao3-help">仅管理 AO3 文库，聊天中已分享的作品副本会保留。</p></fieldset>
    {status && <p role="status" className="ao3-notice">{status}</p>}{error && <p role="alert" className="ao3-notice ao3-error">{error}</p>}
  </section>;
}
