import initialize from '@spensercai/qimen-wasm';
import wasmUrl from '@spensercai/qimen-wasm/qimen_wasm_bg.wasm?url';

let ready: Promise<void> | undefined;
export function initializeQimen(): Promise<void> {
  if (!ready) ready = initialize({ module_or_path: wasmUrl }).then(() => {}).catch(error => {
    ready = undefined;
    console.error('Could not initialize the local Qimen engine:', error);
    throw new Error('本地奇门引擎加载失败，请检查网络或缓存后手动重试。不会改用 AI 编造盘面。');
  });
  return ready;
}
