self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  if (typeof chatId !== 'string') return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find((item) => item.url.startsWith(self.registration.scope));
    if (client) {
      await client.focus();
      client.postMessage({ type: 'yyphone:open-chat', chatId });
    } else {
      const url = new URL(self.registration.scope);
      url.searchParams.set('chat', chatId);
      await self.clients.openWindow(url.href);
    }
  })());
});
