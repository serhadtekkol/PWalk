import React from 'react';
import { Calendar, Diamond } from 'lucide-react';
import type { Task } from '../types/pmam';

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  MEDIUM: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  HIGH: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  URGENT: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
};

export function MyTasksView({
  tasks,
  onSelectTask,
}: {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}) {
  const now = new Date();
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold tracking-tight mb-1">Görevlerim</h2>
        <p className="text-xs text-zinc-500 mb-6">Tüm projelerde size atanan aktif ve tamamlanan görevler</p>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-10 text-center text-sm text-zinc-500">
            Henüz size atanmış bir görev bulunmuyor.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 divide-y divide-zinc-200 dark:divide-zinc-800">
            {tasks.map((t) => {
              const overdue = t.status !== 'DONE' && new Date(t.dueDate) < now;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-zinc-400 shrink-0">{t.code}</span>
                    {t.isMilestone && <Diamond className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    <span className="text-sm font-medium truncate">{t.title}</span>
                    {t.project && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 shrink-0">
                        {t.project.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${PRIORITY_BADGE[t.priority]}`}>
                      {t.priority}
                    </span>
                    <span className="text-xs text-zinc-500 w-10 text-right">%{t.progress}</span>
                    <span
                      className={`text-xs flex items-center gap-1 ${
                        overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-zinc-500'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(t.dueDate).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
