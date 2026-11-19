self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = { title: 'PWalk Bildirimi', body: '' };
  try {
    data = event.data.json();
  } catch {
    data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'PWalk', {
      body: data.body || '',
      tag: data.taskId || 'pmam-notification',
      data,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    }),
  );
});
