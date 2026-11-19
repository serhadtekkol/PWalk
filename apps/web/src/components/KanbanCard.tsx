import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Diamond, Flame, GitBranch } from 'lucide-react';
import type { Task, TaskPriority } from '../types/pmam';

const PRIORITY_META: Record<TaskPriority, { label: string; badge: string; dot: string }> = {
  LOW: {
    label: 'Düşük',
    badge: 'bg-zinc-100/90 text-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-400',
    dot: 'bg-zinc-400',
  },
  MEDIUM: {
    label: 'Orta',
    badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  HIGH: {
    label: 'Yüksek',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  URGENT: {
    label: 'Acil',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
};

export function KanbanCard({
  task,
  subtasks,
  onClick,
  isOverlay = false,
  isCritical = false,
}: {
  task: Task;
  subtasks: Task[];
  onClick: () => void;
  isOverlay?: boolean;
  isCritical?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue = task.status !== 'DONE' && new Date(task.dueDate) < new Date();
  const doneSubs = subtasks.filter((s) => s.status === 'DONE').length;
  const priority = PRIORITY_META[task.priority];
  let parsedTags: string[] = [];
  if (task.tags) {
    try {
      const arr = JSON.parse(task.tags);
      if (Array.isArray(arr)) parsedTags = arr.map(String);
    } catch {
      parsedTags = task.tags.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group rounded-2xl bg-white dark:bg-zinc-900/95 p-3.5 ring-1 ${
        isCritical
          ? 'ring-rose-300/90 dark:ring-rose-800/80 hover:ring-rose-400 dark:hover:ring-rose-700'
          : 'ring-zinc-200/75 dark:ring-zinc-800/80 hover:ring-zinc-300 dark:hover:ring-zinc-700'
      } shadow-xs hover:shadow-md hover:-translate-y-0.5 cursor-grab active:cursor-grabbing transition-all duration-150 ${
        isDragging ? 'opacity-35 scale-[0.98]' : ''
      } ${isOverlay ? 'shadow-xl rotate-1 ring-2 ring-blue-500/40' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 tracking-tight">
            {task.code}
          </span>
          {isCritical && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 font-medium"
              title="Kritik Yol Üzerinde (Bolluk: 0 gün)"
            >
              <Flame className="w-2.5 h-2.5" />
              Kritik
            </span>
          )}
          {task.isMilestone && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium">
              <Diamond className="w-2.5 h-2.5" />
              Kilometre Taşı
            </span>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${priority.badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
          {priority.label}
        </span>
      </div>

      <p className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100 leading-snug mb-2.5 line-clamp-2">
        {task.title}
      </p>

      {parsedTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {parsedTags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {task.progress > 0 && (
        <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 pt-0.5">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
              overdue
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 font-medium'
                : 'bg-zinc-100/80 dark:bg-zinc-800/70'
            }`}
          >
            <Calendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
          </span>
          {subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100/80 dark:bg-zinc-800/70">
              <GitBranch className="w-3 h-3" />
              {doneSubs}/{subtasks.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {task.progress > 0 && (
            <span className="text-[10px] font-medium text-zinc-400">%{task.progress}</span>
          )}
          {task.assignee && (
            <span
              className="w-6 h-6 rounded-full text-[10px] font-semibold text-white flex items-center justify-center shrink-0 ring-2 ring-white dark:ring-zinc-900 shadow-2xs"
              style={{ backgroundColor: task.assignee.avatarColor }}
              title={task.assignee.name}
            >
              {task.assignee.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
