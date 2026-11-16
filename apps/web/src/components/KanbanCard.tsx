import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Diamond, GitBranch } from 'lucide-react';
import type { Task } from '../types/pmam';

const PRIORITY_STYLE: Record<string, string> = {
  LOW: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  MEDIUM: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  HIGH: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  URGENT: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
};

export function KanbanCard({
  task,
  subtasks,
  onClick,
  isOverlay = false,
}: {
  task: Task;
  subtasks: Task[];
  onClick: () => void;
  isOverlay?: boolean;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 cursor-grab active:cursor-grabbing transition ${
        isDragging ? 'opacity-40' : ''
      } ${isOverlay ? 'shadow-lg rotate-1 ring-2 ring-blue-500/30' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-zinc-400">{task.code}</span>
          {task.isMilestone && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-medium">
              <Diamond className="w-2.5 h-2.5" />
              Milestone
            </span>
          )}
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_STYLE[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug mb-2.5 line-clamp-2">
        {task.title}
      </p>

      {/* Progress bar */}
      <div className="w-full h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mb-2.5">
        <div
          className="h-full bg-blue-600 dark:bg-blue-500 transition-all"
          style={{ width: `${task.progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
        <div className="flex items-center gap-2.5">
          <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
            <Calendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
          </span>
          {subtasks.length > 0 && (
            <span className="flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              {doneSubs}/{subtasks.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-400">%{task.progress}</span>
          {task.assignee && (
            <span
              className="w-5 h-5 rounded-full text-[10px] font-semibold text-white flex items-center justify-center shrink-0"
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
