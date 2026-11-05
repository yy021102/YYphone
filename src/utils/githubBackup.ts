export interface GithubBackupConfig { owner: string; repo: string; branch: string }
export interface DeviceBackup { format: 'yyphone-backup'; version: 1; exportedAt: string; data: Record<string, string> }
export function isDeviceBackup(v: unknown): v is DeviceBackup {
  if (!v || typeof v !== 'object') return false;
  const b = v as DeviceBackup;
  return b.format === 'yyphone-backup' && b.version === 1 && typeof b.exportedAt === 'string' &&
    !!b.data && typeof b.data === 'object' && !Array.isArray(b.data) && Object.values(b.data).every(s => typeof s === 'string');
}
export const githubBackupName = (date = new Date()) => `yyphone-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)}.json`;
const base64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s); };
const unbase64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function key(password: string, salt: Uint8Array, usage: KeyUsage[]) {
  const source = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 310000, hash: 'SHA-256' }, source, { name: 'AES-GCM', length: 256 }, false, usage);
}
export async function encryptGithubBackup(backup: DeviceBackup, password: string) {
  if (password.length < 8) throw new Error('备份密码至少 8 位，请妥善保存，恢复时需要同一个密码。');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(password, salt, ['encrypt']), new TextEncoder().encode(JSON.stringify(backup)));
  return JSON.stringify({ format: 'yyphone-encrypted-backup', version: 1, salt: base64(salt), iv: base64(iv), content: base64(new Uint8Array(encrypted)) });
}
export async function decryptGithubBackup(content: string, password: string): Promise<DeviceBackup> {
  try {
    const b = JSON.parse(content);
    if (b.format !== 'yyphone-encrypted-backup' || b.version !== 1 || typeof b.salt !== 'string' || typeof b.iv !== 'string' || typeof b.content !== 'string') throw new Error();
    const salt = unbase64(b.salt), iv = unbase64(b.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error();
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await key(password, salt, ['decrypt']), unbase64(b.content) as BufferSource);
    const result: unknown = JSON.parse(new TextDecoder().decode(plain));
    if (!isDeviceBackup(result)) throw new Error();
    return result;
  } catch { throw new Error('解密失败：密码不正确或备份文件已损坏，当前数据未改动。'); }
}
function repoPath(config: GithubBackupConfig) {
  if (!/^[\w.-]+$/.test(config.owner) || !/^[\w.-]+$/.test(config.repo) || !config.branch.trim()) throw new Error('请填写 GitHub 用户名、仓库名和分支。');
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
}
async function request(config: GithubBackupConfig, token: string, path: string, init: RequestInit = {}) {
  if (!token.trim() || /\s/.test(token.trim())) throw new Error('请填写有效的 GitHub 访问令牌。');
  const response = await fetch(`${repoPath(config)}${path}`, { ...init, signal: AbortSignal.timeout(90000), redirect: 'error', credentials: 'omit', cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.trim()}`, 'X-GitHub-Api-Version': '2026-03-10', ...init.headers } });
  if (!response.ok && response.status !== 404) throw new Error(`GitHub 请求失败 (${response.status})：${response.status === 401 ? '令牌无效或已过期' : response.status === 403 ? '请检查仓库 Contents 读写权限或请求额度' : response.status === 409 ? '分支或文件已变化，请刷新后重试' : '请检查网络、仓库和分支设置' }。`);
  return response;
}
async function checkRepo(c: GithubBackupConfig, token: string) {
  const response = await request(c, token, '');
  if (response.status === 404) throw new Error('找不到仓库，请检查名称和令牌的仓库访问权限。');
  const repo = await response.json();
  if (repo.private !== true) throw new Error('请选择私人仓库存放整机备份。');
}
export async function listGithubBackups(c: GithubBackupConfig, token: string): Promise<string[]> {
  await checkRepo(c, token);
  const response = await request(c, token, `/contents/backups?ref=${encodeURIComponent(c.branch)}`);
  if (response.status === 404) {
    const branch = await request(c, token, `/branches/${encodeURIComponent(c.branch)}`);
    if (branch.status === 404) throw new Error('找不到这个分支，请先在 GitHub 初始化仓库并检查分支名。');
    return [];
  }
  const files = await response.json();
  if (!Array.isArray(files)) throw new Error('仓库的 backups 路径不是文件夹。');
  return files.filter(f => f.type === 'file' && /^yyphone-\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).map(f => String(f.name)).sort().reverse();
}
export async function uploadGithubBackup(c: GithubBackupConfig, token: string, backup: DeviceBackup, password: string) {
  const encrypted = await encryptGithubBackup(backup, password);
  if (new TextEncoder().encode(encrypted).length > 45 * 1024 * 1024) throw new Error('备份超过云端单文件上限，请先使用本地导出或压缩图片。');
  await checkRepo(c, token);
  const name = githubBackupName(), path = `/contents/backups/${name}`;
  const previous = await request(c, token, `${path}?ref=${encodeURIComponent(c.branch)}`);
  const sha = previous.status === 404 ? undefined : (await previous.json()).sha;
  const response = await request(c, token, path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Backup ${name}`, branch: c.branch, content: base64(new TextEncoder().encode(encrypted)), ...(sha ? { sha } : {}) }) });
  if (response.status === 404) throw new Error('上传失败，请检查分支和令牌的仓库写入权限。');
  return name;
}
export async function downloadGithubBackup(c: GithubBackupConfig, token: string, name: string, password: string) {
  if (!/^yyphone-\d{4}-\d{2}-\d{2}\.json$/.test(name)) throw new Error('请选择有效的备份文件。');
  await checkRepo(c, token);
  const response = await request(c, token, `/contents/backups/${name}?ref=${encodeURIComponent(c.branch)}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (response.status === 404) throw new Error('备份文件已不存在，请刷新列表。');
  return decryptGithubBackup(await response.text(), password);
}
