import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Flame, Layers, TrendingUp } from 'lucide-react';
import type { CriticalPathResult, Project, Task, WorkloadReport } from '../types/pmam';

export function DashboardView({
  project,
  tasks,
  criticalPath,
  workload,
  onSelectTask,
}: {
  project: Project;
  tasks: Task[];
  criticalPath: CriticalPathResult | null;
  workload: WorkloadReport | null;
  onSelectTask: (task: Task) => void;
}) {
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const reviewCount = tasks.filter((t) => t.status === 'REVIEW').length;
  const todoCount = tasks.filter((t) => t.status === 'TODO').length;
  const completionPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const now = new Date();
  const overdueTasks = tasks.filter((t) => t.status !== 'DONE' && new Date(t.dueDate) < now);
  const upcomingTasks = tasks
    .filter((t) => t.status !== 'DONE' && new Date(t.dueDate) >= now)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const statusRows = [
    { label: 'Yapılacak', count: todoCount, color: 'bg-zinc-400' },
    { label: 'Devam Ediyor', count: inProgressCount, color: 'bg-blue-500' },
    { label: 'İncelemede', count: reviewCount, color: 'bg-amber-500' },
    { label: 'Tamamlandı', count: doneCount, color: 'bg-emerald-500' },
  ];

  const priorityRows = [
    { label: 'Acil', count: tasks.filter((t) => t.priority === 'URGENT').length, color: 'bg-rose-500' },
    { label: 'Yüksek', count: tasks.filter((t) => t.priority === 'HIGH').length, color: 'bg-amber-500' },
    { label: 'Orta', count: tasks.filter((t) => t.priority === 'MEDIUM').length, color: 'bg-sky-500' },
    { label: 'Düşük', count: tasks.filter((t) => t.priority === 'LOW').length, color: 'bg-zinc-400' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/70 dark:bg-zinc-950 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 ring-1 ring-zinc-200/75 dark:ring-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span>Tamamlanma Oranı</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">%{completionPct}</div>
          <div className="mt-2.5 w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionPct}%` }} />
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 ring-1 ring-zinc-200/75 dark:ring-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span>Toplam Görev</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{total}</div>
          <p className="text-xs text-zinc-500 mt-1">
            {doneCount} tamamlandı · {total - doneCount} açık
          </p>
        </div>

        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 ring-1 ring-zinc-200/75 dark:ring-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span>Geciken Görevler</span>
            <AlertTriangle className={`w-4 h-4 ${overdueTasks.length > 0 ? 'text-rose-500' : 'text-zinc-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
            {overdueTasks.length}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {overdueTasks.length === 0 ? 'Tüm görevler takvimde' : 'Hemen aksiyon gerektiriyor'}
          </p>
        </div>

        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 ring-1 ring-zinc-200/75 dark:ring-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span>Kritik Yol Süresi</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {criticalPath?.projectDurationDays ?? 0} gün
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {criticalPath?.criticalTaskIds.length ?? 0} kritik görev zincirde
          </p>
        </div>
      </div>

      {/* Distribution & Team */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 ring-1 ring-zinc-200/75 dark:ring-zinc-800 space-y-3.5">
          <h3 className="text-sm font-semibold">Durum Dağılımı</h3>
          <div className="space-y-3">
            {statusRows.map((row) => {
              const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300">{row.label}</span>
                    <span className="font-mono text-zinc-500">{row.count} (%{pct})</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 ring-1 ring-zinc-200/75 dark:ring-zinc-800 space-y-3.5">
          <h3 className="text-sm font-semibold">Öncelik Dağılımı</h3>
          <div className="space-y-3">
            {priorityRows.map((row) => {
              const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300">{row.label}</span>
                    <span className="font-mono text-zinc-500">{row.count} (%{pct})</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 ring-1 ring-zinc-200/75 dark:ring-zinc-800 space-y-3.5">
          <h3 className="text-sm font-semibold">Takım Üyeleri ({project.members.length})</h3>
          <div className="space-y-2.5">
            {project.members.map((m) => {
              const assignedCount = tasks.filter((t) => t.assigneeId === m.userId && t.status !== 'DONE').length;
              const overloaded =
                workload?.members.find((w) => w.userId === m.userId)?.days.filter((d) => d.overloaded).length ?? 0;
              return (
                <div key={m.userId} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-7 h-7 rounded-full text-[11px] font-semibold text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: m.user.avatarColor }}
                    >
                      {m.user.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.user.name}</div>
                      <div className="text-[11px] text-zinc-400">{assignedCount} açık görev</div>
                    </div>
                  </div>
                  {overloaded > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-[10px] font-medium">
                      {overloaded} gün yoğun
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 text-[10px] font-medium">
                      Dengeli
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Upcoming & Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 ring-1 ring-zinc-200/75 dark:ring-zinc-800 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            Geciken Görevler
          </h3>
          {overdueTasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-400 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Geciken görev yok.
            </div>
          ) : (
            <div className="space-y-1.5">
              {overdueTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs text-left transition"
                >
                  <span className="truncate">
                    <span className="font-mono text-zinc-400 mr-2">{t.code}</span>
                    <span className="font-medium">{t.title}</span>
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium shrink-0 ml-2">
                    {new Date(t.dueDate).toLocaleDateString('tr-TR')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white dark:bg-zinc-900 p-5 ring-1 ring-zinc-200/75 dark:ring-zinc-800 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-500" />
            Yaklaşan Bitiş Tarihleri
          </h3>
          {upcomingTasks.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-400">Açık görev bulunmuyor.</div>
          ) : (
            <div className="space-y-1.5">
              {upcomingTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs text-left transition"
                >
                  <span className="truncate">
                    <span className="font-mono text-zinc-400 mr-2">{t.code}</span>
                    <span className="font-medium">{t.title}</span>
                  </span>
                  <span className="text-zinc-500 shrink-0 ml-2">
                    {new Date(t.dueDate).toLocaleDateString('tr-TR')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
