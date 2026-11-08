import { renderChatRegex } from './chatRegex';
self.onmessage = event => {
  const { text, sender, settings } = event.data;
  try { self.postMessage({ result: renderChatRegex(text, sender, settings) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : '正则执行失败。' }); }
};
