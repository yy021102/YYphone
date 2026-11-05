import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { decryptGithubBackup, downloadGithubBackup, encryptGithubBackup, githubBackupName, listGithubBackups, uploadGithubBackup, type DeviceBackup } from './githubBackup';
afterEach(() => mock.restoreAll());
const backup: DeviceBackup = { format: 'yyphone-backup', version: 1, exportedAt: '2026-11-06T00:00:00Z', data: { messages: JSON.stringify(['你好', '多行\n内容']), api: 'test-api-key' } };
const config = { owner: 'tester', repo: 'private-backups', branch: 'main' };
test('backup names use Shanghai dates and encryption round-trips Unicode without exposing backup contents', async () => {
  assert.equal(githubBackupName(new Date('2026-11-05T17:00:00Z')), 'yyphone-2026-11-06.json');
  const encrypted = await encryptGithubBackup(backup, 'test-password');
  assert.ok(!encrypted.includes('test-api-key') && !encrypted.includes('你好'));
  assert.deepEqual(await decryptGithubBackup(encrypted, 'test-password'), backup);
  await assert.rejects(decryptGithubBackup(encrypted, 'wrong-password'), /解密失败/);
  await assert.rejects(encryptGithubBackup(backup, 'short'), /至少 8 位/);
});
test('GitHub upload uses a date file, authenticated API only, updates using SHA, and restores via raw contents', async () => {
  let stored = '', written = 0;
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    const u = new URL(String(url)); assert.equal(u.origin, 'https://api.github.com');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer fake-token');
    if (u.pathname.endsWith('/private-backups')) return Response.json({ private: true });
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body));
      assert.equal(body.branch, 'main'); assert.equal(body.sha, written ? 'old-sha' : undefined);
      stored = Buffer.from(body.content, 'base64').toString('utf8'); written++; return Response.json({}, { status: 201 });
    }
    if ((init?.headers as Record<string, string>).Accept === 'application/vnd.github.raw+json') return new Response(stored);
    if (u.pathname.endsWith('/contents/backups')) return Response.json([{ type: 'file', name: githubBackupName() }, { type: 'file', name: 'unrelated.json' }]);
    return written ? Response.json({ sha: 'old-sha' }) : new Response('', { status: 404 });
  });
  assert.equal(await uploadGithubBackup(config, 'fake-token', backup, 'test-password'), githubBackupName());
  await uploadGithubBackup(config, 'fake-token', backup, 'test-password'); assert.equal(written, 2);
  assert.deepEqual(await listGithubBackups(config, 'fake-token'), [githubBackupName()]);
  assert.deepEqual(await downloadGithubBackup(config, 'fake-token', githubBackupName(), 'test-password'), backup);
});
test('public repositories, denied access, and invalid paths fail without writes or token exposure', async () => {
  let writes = 0;
  const stub = mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => { if (init?.method === 'PUT') writes++; return Response.json({ private: false }); });
  await assert.rejects(uploadGithubBackup(config, 'fake-token', backup, 'test-password'), /私人仓库/);
  stub.mock.mockImplementation(async () => new Response('fake-token should not be echoed', { status: 401 }));
  await assert.rejects(listGithubBackups(config, 'fake-token'), error => error instanceof Error && error.message.includes('401') && !error.message.includes('fake-token'));
  await assert.rejects(downloadGithubBackup(config, 'fake-token', '../secret', 'test-password'), /有效的备份/);
  assert.equal(writes, 0);
});
