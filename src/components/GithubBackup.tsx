import { useState } from 'react';
import { getAllCachedStorageItems, initializeDbStorage } from '../utils/dbStorage';
import { readStoredValue, writeStoredValue } from '../utils/localStorage';
import { downloadGithubBackup, listGithubBackups, uploadGithubBackup, type GithubBackupConfig } from '../utils/githubBackup';
const CONFIG_KEY = 'yyphone:github-backup-config';
export function GithubBackup({ onRestore }: { onRestore: (file: File) => Promise<void> }) {
  const [config, setConfig] = useState(() => readStoredValue<GithubBackupConfig>(CONFIG_KEY, { owner: '', repo: '', branch: 'main' }, (v): v is GithubBackupConfig => !!v && typeof v === 'object' && ['owner', 'repo', 'branch'].every(k => typeof (v as Record<string, unknown>)[k] === 'string')));
  const [token, setToken] = useState(''), [password, setPassword] = useState(''), [files, setFiles] = useState<string[]>([]), [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const change = (key: keyof GithubBackupConfig, value: string) => { setConfig(c => ({ ...c, [key]: value.trim() })); setFiles([]); setSelected(''); };
  const run = async (task: () => Promise<void>) => { setBusy(true); setError(''); setMessage(''); try { writeStoredValue(CONFIG_KEY, config); await task(); } catch (cause) { setError(cause instanceof Error ? cause.message : '连接失败，请重试。'); } finally { setBusy(false); } };
  const refresh = async () => { const next = await listGithubBackups(config, token); setFiles(next); setSelected(next[0] ?? ''); setMessage(next.length ? '备份列表已更新' : '连接成功，还没有云端备份'); };
  const field = 'w-full min-w-0 rounded-xl border border-white bg-white/80 p-2 text-xs';
  return <details className="rounded-2xl border border-white bg-white/40 p-3"><summary className="cursor-pointer text-xs font-bold text-[#2C4A5C]">GitHub 云端备份</summary>
    <fieldset disabled={busy} className="mt-3 min-w-0 space-y-3"><p className="text-[10px] leading-relaxed text-slate-500">备份加密保存到私人仓库。令牌与备份密码仅在本次页面中使用，不会存入备份；恢复时需要原密码。</p>
      <label className="block text-[11px]">GitHub 用户名<input className={field} value={config.owner} onChange={e => change('owner', e.target.value)}/></label>
      <label className="block text-[11px]">私人仓库名<input className={field} value={config.repo} onChange={e => change('repo', e.target.value)}/></label>
      <label className="block text-[11px]">分支<input className={field} value={config.branch} onChange={e => change('branch', e.target.value)}/></label>
      <label className="block text-[11px]">GitHub 访问令牌<input className={field} type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)}/></label>
      <a className="text-[10px] text-sky-700 underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">创建令牌：仅选择备份仓库，Contents 设置为读写</a>
      <label className="block text-[11px]">备份密码<input className={field} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></label>
      <div className="flex gap-2"><button className={field} onClick={() => void run(refresh)}>连接并刷新</button><button className={field} onClick={() => void run(async () => {
        if (!window.confirm('上传整机加密备份到此私人仓库？同一天已有备份会被更新，请确认今天使用的是同一个备份密码。')) return;
        await initializeDbStorage(); const name = await uploadGithubBackup(config, token, { format: 'yyphone-backup', version: 1, exportedAt: new Date().toISOString(), data: getAllCachedStorageItems() }, password);
        setMessage(`已备份：${name}`); setFiles(old => [...new Set([name, ...old])].sort().reverse()); setSelected(name);
      })}>备份到 GitHub</button></div>
      {files.length > 0 && <><select aria-label="云端备份文件" className={field} value={selected} onChange={e => setSelected(e.target.value)}>{files.map(name => <option key={name}>{name}</option>)}</select><button className={field} onClick={() => void run(async () => {
        const backup = await downloadGithubBackup(config, token, selected, password);
        await onRestore(new File([JSON.stringify(backup)], selected, { type: 'application/json' }));
      })}>从云端恢复</button></>}
    </fieldset>{busy && <p role="status" className="mt-2 text-[11px] text-slate-500">正在处理备份…</p>}{message && <p role="status" className="mt-2 break-all text-[11px] text-emerald-700">{message}</p>}{error && <p role="alert" className="mt-2 text-[11px] text-rose-600">{error}</p>}
  </details>;
}
