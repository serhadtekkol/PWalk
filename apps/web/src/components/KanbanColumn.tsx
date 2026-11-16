import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AlertTriangle, Plus } from 'lucide-react';
import type { BoardColumn, Task } from '../types/pmam';
import { KanbanCard } from './KanbanCard';

export function KanbanColumn({
  column,
  tasks,
  allTasks,
  onSelectTask,
  onQuickCreate,
}: {
  column: BoardColumn;
  tasks: Task[];
  allTasks: Task[];
  onSelectTask: (task: Task) => void;
  onQuickCreate: (columnId: string, title: string) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${column.id}`,
    data: { type: 'column', columnId: column.id },
  });

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  const wipExceeded = column.wipLimit !== null && tasks.length > column.wipLimit;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onQuickCreate(column.id, title.trim());
    setTitle('');
    setAdding(false);
  };

  return (
    <div
      className={`w-76 shrink-0 flex flex-col rounded-2xl border ${
        wipExceeded
          ? 'border-amber-400/70 dark:border-amber-600/60'
          : 'border-zinc-200/80 dark:border-zinc-800/80'
      } bg-zinc-100/70 dark:bg-zinc-900/40 max-h-full`}
    >
      <div className="px-3.5 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: column.color || '#64748b' }}
          />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 truncate">
            {column.name}
          </h3>
          <span className="text-xs font-mono text-zinc-400">{tasks.length}</span>
          {column.wipLimit !== null && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${
                wipExceeded
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-zinc-200/70 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
              title="WIP Limiti"
            >
              {wipExceeded && <AlertTriangle className="w-2.5 h-2.5" />}
              max {column.wipLimit}
            </span>
          )}
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="p-1 rounded-md text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          title="Hızlı Görev Ekle"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="px-2.5 pb-2">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Görev başlığı yazıp Enter'a basın..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      )}

      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto px-2.5 pb-3 space-y-2.5 min-h-[120px] transition ${
          isOver ? 'bg-blue-500/5 rounded-b-2xl' : ''
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              subtasks={allTasks.filter((t) => t.parentId === task.id)}
              onClick={() => onSelectTask(task)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
