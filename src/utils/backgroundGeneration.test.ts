import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backgroundGenerationState, startBackgroundGeneration, stopBackgroundGeneration, subscribeBackgroundGeneration } from './backgroundGeneration';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
test('leaving and returning to a subscriber retains pending work, isolates conversations and prevents duplicate requests', async () => {
  let complete!: () => void, writes = 0, calls = 0;
  const unsubscribe = subscribeBackgroundGeneration(() => {});
  startBackgroundGeneration('conversation-a', async () => { calls++; await new Promise<void>(resolve => { complete = resolve; }); writes++; });
  unsubscribe();
  assert.equal(backgroundGenerationState('conversation-a').running, true);
  assert.equal(backgroundGenerationState('conversation-b').running, false);
  startBackgroundGeneration('conversation-a', async () => { calls++; });
  assert.equal(calls, 1);
  let notified = 0;
  const returned = subscribeBackgroundGeneration(() => { notified++; });
  complete(); await tick();
  assert.equal(writes, 1);
  assert.equal(backgroundGenerationState('conversation-a').running, false);
  assert.equal(notified, 1); returned();
});

test('stop then restart cannot let a late old request clear the new run or its error', async () => {
  let finishOld!: () => void, finishNew!: () => void;
  let oldSignal!: AbortSignal;
  startBackgroundGeneration('restart', async signal => { oldSignal = signal; await new Promise<void>(resolve => { finishOld = resolve; }); signal.throwIfAborted(); });
  stopBackgroundGeneration('restart');
  assert.equal(oldSignal.aborted, true);
  startBackgroundGeneration('restart', async () => { await new Promise<void>(resolve => { finishNew = resolve; }); throw new Error('连接失败'); });
  finishOld(); await tick();
  assert.equal(backgroundGenerationState('restart').running, true);
  finishNew(); await tick();
  assert.deepEqual(backgroundGenerationState('restart'), { running: false, error: '连接失败' });
  stopBackgroundGeneration('restart');
  assert.equal(backgroundGenerationState('restart').error, '');
});
