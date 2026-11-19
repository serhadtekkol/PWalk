import React, { useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Project } from '../types/pmam';

const COLORS = ['#0f172a', '#2563eb', '#0d9488', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];

export function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[1]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const created = await apiFetch<Project>('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({ name, key: key.toUpperCase(), description, color }),
      });
      setName('');
      setKey('');
      setDescription('');
      onCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Yeni Proje Oluştur</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Proje Adı</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!key) {
                  setKey(
                    e.target.value
                      .replace(/[^A-Za-z0-9]/g, '')
                      .slice(0, 4)
                      .toUpperCase(),
                  );
                }
              }}
              placeholder="Örn. Yeni ERP Geçişi"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Proje Anahtarı (Key)</label>
            <input
              type="text"
              required
              maxLength={10}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="ERP"
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Açıklama</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Renk</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
            >
              {loading ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
