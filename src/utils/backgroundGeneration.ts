interface GenerationState { running: boolean; error: string }
const idle: GenerationState = { running: false, error: '' };
const states = new Map<string, GenerationState>();
const runs = new Map<string, AbortController>();
const listeners = new Set<() => void>();
export const backgroundGenerationState = (key: string): GenerationState => states.get(key) ?? idle;
export const subscribeBackgroundGeneration = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const publish = (key: string, state: GenerationState) => {
  states.set(key, state);
  listeners.forEach(listener => listener());
};

/** A page can unsubscribe without cancelling its request or losing the outcome. */
export function startBackgroundGeneration(key: string, task: (signal: AbortSignal) => Promise<void>): void {
  if (runs.has(key)) return;
  const controller = new AbortController();
  runs.set(key, controller);
  publish(key, { running: true, error: '' });
  void (async () => {
    try {
      await task(controller.signal);
      if (runs.get(key) === controller) publish(key, idle);
    } catch (error) {
      if (runs.get(key) === controller) publish(key, { running: false,
        error: controller.signal.aborted ? '' : error instanceof Error ? error.message : '生成失败，请重试。' });
    } finally {
      if (runs.get(key) === controller) runs.delete(key);
    }
  })();
}

export function stopBackgroundGeneration(key: string): void {
  const controller = runs.get(key);
  runs.delete(key);
  controller?.abort();
  publish(key, idle);
}
