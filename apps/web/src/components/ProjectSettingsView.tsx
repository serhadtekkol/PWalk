import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Project, ProjectRole, User } from '../types/pmam';

export function ProjectSettingsView({
  project,
  onUpdated,
}: {
  project: Project;
  onUpdated: () => Promise<void>;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState<ProjectRole>('EDITOR');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<User[]>('/api/v1/users')
      .then(setUsers)
      .catch(() => {});
  }, []);

  const nonMembers = users.filter((u) => !project.members.some((m) => m.userId === u.id));

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setError('');
    try {
      await apiFetch(`/api/v1/projects/${project.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: selectedUserId, role }),
      });
      setSelectedUserId('');
      await onUpdated();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRoleChange = async (userId: string, newRole: ProjectRole) => {
    await apiFetch(`/api/v1/projects/${project.id}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole }),
    });
    await onUpdated();
  };

  const handleRemoveMember = async (userId: string) => {
    await apiFetch(`/api/v1/projects/${project.id}/members/${userId}`, { method: 'DELETE' });
    await onUpdated();
  };

  const handleDeleteColumn = async (colId: string) => {
    setError('');
    try {
      await apiFetch(`/api/v1/columns/${colId}`, { method: 'DELETE' });
      await onUpdated();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-4">
          <h3 className="text-sm font-semibold">Proje Üyeleri ve Yetkiler</h3>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {project.members.map((m) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-6 h-6 rounded-full text-[10px] font-semibold text-white flex items-center justify-center"
                    style={{ backgroundColor: m.user.avatarColor }}
                  >
                    {m.user.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div className="font-medium">{m.user.name}</div>
                    <div className="text-zinc-400">{m.user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.userId, e.target.value as ProjectRole)}
                    className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="EDITOR">EDITOR</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                  <button
                    onClick={() => handleRemoveMember(m.userId)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddMember} className="flex flex-wrap gap-2 pt-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            >
              <option value="">Üye eklemek için kullanıcı seçin...</option>
              {nonMembers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ProjectRole)}
              className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            >
              <option value="EDITOR">EDITOR</option>
              <option value="VIEWER">VIEWER</option>
              <option value="OWNER">OWNER</option>
            </select>
            <button
              type="submit"
              className="px-3 py-2 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Ekle
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 space-y-3">
          <h3 className="text-sm font-semibold">Kanban Sütunları</h3>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {project.columns.map((c) => (
              <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color || '#64748b' }} />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-zinc-400">({c.mappedStatus})</span>
                </div>
                <button
                  onClick={() => handleDeleteColumn(c.id)}
                  className="text-red-500 hover:underline text-[11px]"
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
