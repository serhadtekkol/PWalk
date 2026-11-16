import React, { useEffect, useState } from 'react';
import {
  Bell,
  Clock,
  Diamond,
  GitBranch,
  Link2,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import type {
  BoardColumn,
  DependencyType,
  ProjectMember,
  Reminder,
  Task,
  TaskActivity,
  TaskComment,
  TaskPriority,
} from '../types/pmam';

export function TaskDrawer({
  task,
  allTasks,
  columns,
  members,
  onClose,
  onUpdated,
  onDeleted,
  onCreateSubtask,
  onSelectTask,
}: {
  task: Task | null;
  allTasks: Task[];
  columns: BoardColumn[];
  members: ProjectMember[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onDeleted: () => Promise<void>;
  onCreateSubtask: (parentId: string, title: string) => Promise<void>;
  onSelectTask: (t: Task) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [columnId, setColumnId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(8);
  const [progress, setProgress] = useState(0);
  const [isMilestone, setIsMilestone] = useState(false);

  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [depPredId, setDepPredId] = useState('');
  const [depType, setDepType] = useState<DependencyType>('FS');
  const [depLag, setDepLag] = useState(0);

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [remindMsg, setRemindMsg] = useState('');
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setPriority(task.priority);
    setColumnId(task.columnId);
    setAssigneeId(task.assigneeId ?? '');
    setStartDate(task.startDate.slice(0, 10));
    setDueDate(task.dueDate.slice(0, 10));
    setEstimatedHours(task.estimatedHours);
    setProgress(task.progress);
    setIsMilestone(task.isMilestone);
    setError('');

    Promise.all([
      apiFetch<TaskComment[]>(`/api/v1/tasks/${task.id}/comments`),
      apiFetch<TaskActivity[]>(`/api/v1/tasks/${task.id}/activity`),
      apiFetch<Reminder[]>(`/api/v1/tasks/${task.id}/reminders`),
    ])
      .then(([c, a, r]) => {
        setComments(c);
        setActivities(a);
        setReminders(r);
      })
      .catch(() => {});
  }, [task]);

  if (!task) return null;

  const subtasks = allTasks.filter((t) => t.parentId === task.id);
  const availablePredecessors = allTasks.filter((t) => t.id !== task.id);

  const handleSave = async () => {
    setError('');
    try {
      const targetCol = columns.find((c) => c.id === columnId);
      await apiFetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          description: description || null,
          priority,
          columnId,
          status: targetCol?.mappedStatus,
          assigneeId: assigneeId || null,
          startDate: new Date(startDate).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          estimatedHours: Number(estimatedHours),
          progress: Number(progress),
          isMilestone,
        }),
      });
      await onUpdated();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    await apiFetch(`/api/v1/tasks/${task.id}`, { method: 'DELETE' });
    await onDeleted();
    onClose();
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskTitle.trim()) return;
    await onCreateSubtask(task.id, subtaskTitle.trim());
    setSubtaskTitle('');
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depPredId) return;
    setError('');
    try {
      await apiFetch(`/api/v1/tasks/${task.id}/dependencies`, {
        method: 'POST',
        body: JSON.stringify({ predecessorId: depPredId, type: depType, lagDays: Number(depLag) }),
      });
      setDepPredId('');
      await onUpdated();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveDependency = async (depId: string) => {
    await apiFetch(`/api/v1/dependencies/${depId}`, { method: 'DELETE' });
    await onUpdated();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    const c = await apiFetch<TaskComment>(`/api/v1/tasks/${task.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: commentBody.trim() }),
    });
    setComments((prev) => [...prev, c]);
    setCommentBody('');
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remindAt) return;
    const r = await apiFetch<Reminder>(`/api/v1/tasks/${task.id}/reminders`, {
      method: 'POST',
      body: JSON.stringify({ remindAt: new Date(remindAt).toISOString(), message: remindMsg || undefined }),
    });
    setReminders((prev) => [...prev, r]);
    setRemindAt('');
    setRemindMsg('');
  };

  const handleDeleteReminder = async (remId: string) => {
    await apiFetch(`/api/v1/reminders/${remId}`, { method: 'DELETE' });
    setReminders((prev) => prev.filter((r) => r.id !== remId));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[1px]" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white dark:bg-zinc-900 h-full border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 px-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {task.code}
            </span>
            {isMilestone && <Diamond className="w-4 h-4 text-amber-500" />}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              title="Görevi Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg font-semibold bg-transparent border-b border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 focus:outline-none pb-1"
            />
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Görev açıklaması ekleyin..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-zinc-500 mb-1">Sütun / Durum</label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-500 mb-1">Öncelik</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                <option value="LOW">Düşük (LOW)</option>
                <option value="MEDIUM">Orta (MEDIUM)</option>
                <option value="HIGH">Yüksek (HIGH)</option>
                <option value="URGENT">Acil (URGENT)</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-500 mb-1">Atanan Kişi</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                <option value="">Atanmamış</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-500 mb-1">Tahmini Efor (Saat)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
              />
            </div>

            <div>
              <label className="block text-zinc-500 mb-1">Başlangıç Tarihi</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
              />
            </div>

            <div>
              <label className="block text-zinc-500 mb-1">Bitiş Tarihi</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 text-xs">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-zinc-500">İlerleme</span>
                <span className="font-mono font-medium">%{progress}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-4">
              <input
                type="checkbox"
                checked={isMilestone}
                onChange={(e) => setIsMilestone(e.target.checked)}
                className="rounded"
              />
              <span>Kilometre Taşı (Milestone)</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:opacity-90"
            >
              Değişiklikleri Kaydet
            </button>
          </div>

          {/* Subtasks */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              Alt Görevler ({subtasks.length})
            </h4>
            <div className="space-y-1">
              {subtasks.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectTask(s)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-zinc-400">{s.code}</span>
                    <span>{s.title}</span>
                  </span>
                  <span className="text-zinc-400">%{s.progress}</span>
                </button>
              ))}
            </div>
            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <input
                type="text"
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                placeholder="Alt görev ekle..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Ekle
              </button>
            </form>
          </div>

          {/* Dependencies */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              Öncül Bağımlılıklar (MS Project)
            </h4>
            <div className="space-y-1">
              {(task.predecessorLinks ?? []).map((dep) => {
                const pred = allTasks.find((t) => t.id === dep.predecessorId);
                return (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-xs"
                  >
                    <span>
                      <span className="font-mono text-zinc-400 mr-1.5">{pred?.code}</span>
                      {pred?.title} ({dep.type} {dep.lagDays >= 0 ? `+${dep.lagDays}g` : `${dep.lagDays}g`})
                    </span>
                    <button
                      onClick={() => handleRemoveDependency(dep.id)}
                      className="text-red-500 hover:underline text-[11px]"
                    >
                      Kaldır
                    </button>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleAddDependency} className="flex flex-wrap gap-2">
              <select
                value={depPredId}
                onChange={(e) => setDepPredId(e.target.value)}
                className="flex-1 min-w-[160px] px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                <option value="">Öncül görev seçin...</option>
                {availablePredecessors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} - {t.title}
                  </option>
                ))}
              </select>
              <select
                value={depType}
                onChange={(e) => setDepType(e.target.value as DependencyType)}
                className="px-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                <option value="FS">FS</option>
                <option value="SS">SS</option>
                <option value="FF">FF</option>
                <option value="SF">SF</option>
              </select>
              <input
                type="number"
                value={depLag}
                onChange={(e) => setDepLag(Number(e.target.value))}
                className="w-16 px-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
                title="Gecikme (gün)"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Bağla
              </button>
            </form>
          </div>

          {/* Reminders */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <h4 className="text-xs font-semibold flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              Push Hatırlatmalar
            </h4>
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-xs">
                <span>
                  {new Date(r.remindAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                  {r.message ? ` — ${r.message}` : ''}
                  {r.sentAt && <span className="ml-2 text-emerald-600">(Gönderildi)</span>}
                </span>
                <button onClick={() => handleDeleteReminder(r.id)} className="text-red-500 text-[11px] hover:underline">
                  Sil
                </button>
              </div>
            ))}
            <form onSubmit={handleAddReminder} className="flex flex-wrap gap-2">
              <input
                type="datetime-local"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
              />
              <input
                type="text"
                value={remindMsg}
                onChange={(e) => setRemindMsg(e.target.value)}
                placeholder="Not (opsiyonel)"
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Kur
              </button>
            </form>
          </div>

          {/* Comments & Activity */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium">
              <button
                onClick={() => setTab('comments')}
                className={`pb-2 flex items-center gap-1.5 border-b-2 transition ${
                  tab === 'comments' ? 'border-zinc-900 dark:border-zinc-100' : 'border-transparent text-zinc-500'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Yorumlar ({comments.length})
              </button>
              <button
                onClick={() => setTab('activity')}
                className={`pb-2 flex items-center gap-1.5 border-b-2 transition ${
                  tab === 'activity' ? 'border-zinc-900 dark:border-zinc-100' : 'border-transparent text-zinc-500'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Aktivite ({activities.length})
              </button>
            </div>

            {tab === 'comments' ? (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-800/40 p-3 text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold">{c.user.name}</span>
                      <span className="text-zinc-400">
                        {new Date(c.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Yorum yazın..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  >
                    Gönder
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map((a) => (
                  <div key={a.id} className="text-xs text-zinc-500 flex justify-between">
                    <span>
                      <strong className="text-zinc-700 dark:text-zinc-300">{a.user.name}</strong> — {a.action}
                    </span>
                    <span>{new Date(a.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
