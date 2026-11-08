import type { ChatRegexSettings, renderChatRegex } from './chatRegex';
type Result = ReturnType<typeof renderChatRegex>;
let worker: Worker | undefined, queue = Promise.resolve();
const cache = new Map<string, Promise<Result>>();
const identities = new WeakMap<ChatRegexSettings, number>();
const timedOut = new Set<number>();
let nextIdentity = 0;
export function runChatRegex(text: string, sender: 'character' | 'user', settings: ChatRegexSettings): Promise<Result> {
  if (!settings.enabled || !settings.rules.some(rule => rule.enabled && (rule.target === 'both' || rule.target === sender))) return Promise.resolve(null);
  if (!identities.has(settings)) identities.set(settings, ++nextIdentity);
  const identity = identities.get(settings)!;
  if (timedOut.has(identity)) return Promise.reject(new Error('正则执行超时，请修改规则后重试。'));
  const key = `${identity}:${sender}:${text}`;
  const cached = cache.get(key); if (cached) return cached;
  const result = queue.then(() => new Promise<Result>((resolve, reject) => {
    if (timedOut.has(identity)) { reject(new Error('正则执行超时，请修改规则后重试。')); return; }
    if (!worker) worker = new Worker(new URL('./chatRegex.worker.ts', import.meta.url), { type: 'module' });
    const current = worker;
    const cleanup = () => { clearTimeout(timer); current.onmessage = null; current.onerror = null; };
    const timer = setTimeout(() => { cleanup(); timedOut.add(identity); current.terminate(); worker = undefined; reject(new Error('正则执行超时，请简化匹配表达式。')); }, 1000);
    current.onmessage = event => { cleanup(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.result); };
    current.onerror = () => { cleanup(); current.terminate(); worker = undefined; reject(new Error('正则执行失败，请检查规则。')); };
    current.postMessage({ text, sender, settings });
  }));
  queue = result.then(() => undefined, () => undefined);
  cache.set(key, result); if (cache.size > 64) cache.delete(cache.keys().next().value!);
  return result;
}
