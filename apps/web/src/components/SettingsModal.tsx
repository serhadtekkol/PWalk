import React, { useState } from 'react';
import { BellRing, Send, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../stores/auth';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, refreshMe } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [dailyCapacityHours, setDailyCapacityHours] = useState(user?.dailyCapacityHours ?? 8);
  const [ntfyTopic, setNtfyTopic] = useState(user?.ntfyTopic ?? '');
  const [statusMsg, setStatusMsg] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg('');
    try {
      await apiFetch('/api/v1/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          dailyCapacityHours: Number(dailyCapacityHours),
          ntfyTopic: ntfyTopic.trim() || null,
        }),
      });
      await refreshMe();
      setStatusMsg('Profil ayarları kaydedildi.');
    } catch (err: any) {
      setStatusMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEnableWebPush = async () => {
    setStatusMsg('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatusMsg('Tarayıcınız Web Push desteklemiyor.');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatusMsg('Bildirim izni reddedildi.');
        return;
      }
      const { publicKey } = await apiFetch<{ publicKey: string | null }>('/api/v1/push/vapid-public-key');
      if (!publicKey) {
        setStatusMsg('Sunucuda VAPID anahtarı tanımlı değil (.env kontrol edin).');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await apiFetch('/api/v1/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          platform: 'WEB',
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      });
      setStatusMsg('Tarayıcı Web Push aboneliği aktif edildi.');
    } catch (err: any) {
      setStatusMsg(err.message || 'Web Push etkinleştirilemedi.');
    }
  };

  const handleTestPush = async () => {
    await apiFetch('/api/v1/push/test', { method: 'POST' });
    setStatusMsg('Test bildirimi gönderildi.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">Profil &amp; Bildirim Ayarları</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Ad Soyad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Günlük Çalışma Kapasitesi (Saat)
            </label>
            <input
              type="number"
              min={1}
              max={24}
              value={dailyCapacityHours}
              onChange={(e) => setDailyCapacityHours(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">ntfy Topic (Opsiyonel)</label>
            <input
              type="text"
              value={ntfyTopic}
              onChange={(e) => setNtfyTopic(e.target.value)}
              placeholder="ör. pmam-serhad"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
            />
          </div>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEnableWebPush}
              className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <BellRing className="w-3.5 h-3.5" />
              Tarayıcı Push İzni Ver
            </button>
            <button
              type="button"
              onClick={handleTestPush}
              className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Send className="w-3.5 h-3.5" />
              Test Bildirimi Gönder
            </button>
          </div>

          {statusMsg && <p className="text-xs text-blue-600 dark:text-blue-400">{statusMsg}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
              Kapat
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
