import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AlertTriangle, ArrowLeft, ArrowRight, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { BoardColumn, Task } from '../types/pmam';
import { KanbanCard } from './KanbanCard';

export function KanbanColumn({
  column,
  tasks,
  allTasks,
  criticalTaskIds,
  canMoveLeft = false,
  canMoveRight = false,
  onSelectTask,
  onQuickCreate,
  onEditColumn,
  onDeleteColumn,
  onMoveColumn,
}: {
  column: BoardColumn;
  tasks: Task[];
  allTasks: Task[];
  criticalTaskIds?: Set<string>;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onSelectTask: (task: Task) => void;
  onQuickCreate: (columnId: string, title: string) => Promise<void>;
  onEditColumn: (column: BoardColumn) => void;
  onDeleteColumn: (column: BoardColumn) => Promise<void>;
  onMoveColumn?: (columnId: string, dir: -1 | 1) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${column.id}`,
    data: { type: 'column', columnId: column.id },
  });

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const wipExceeded = column.wipLimit !== null && tasks.length > column.wipLimit;
  const colColor = column.color || '#64748b';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onQuickCreate(column.id, title.trim());
    setTitle('');
    setAdding(false);
  };

  return (
    <div
      className={`w-80 shrink-0 flex flex-col rounded-3xl transition-colors duration-150 ${
        wipExceeded
          ? 'ring-1 ring-amber-400/70 dark:ring-amber-600/60 bg-amber-50/40 dark:bg-amber-950/15'
          : isOver
          ? 'ring-2 ring-blue-400/60 bg-blue-50/40 dark:bg-blue-950/20'
          : 'ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 bg-zinc-100/65 dark:bg-zinc-900/45'
      } max-h-full`}
    >
      {/* Column Header */}
      <div className="px-3.5 pt-3.5 pb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-tight truncate"
            style={{
              backgroundColor: `${colColor}18`,
              color: colColor,
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: colColor }}
            />
            <span className="truncate">{column.name}</span>
          </span>

          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-semibold bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
            {tasks.length}
          </span>

          {column.wipLimit !== null && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                wipExceeded
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-zinc-200/60 text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-400'
              }`}
              title="WIP Limiti"
            >
              {wipExceeded && <AlertTriangle className="w-2.5 h-2.5" />}
              max {column.wipLimit}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0 relative" ref={menuRef}>
          <button
            onClick={() => setAdding((v) => !v)}
            className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition"
            title="Hızlı Görev Ekle"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition"
            title="Kolon İşlemleri"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-30 w-44 rounded-2xl bg-white dark:bg-zinc-900 shadow-lg ring-1 ring-zinc-200 dark:ring-zinc-800 p-1.5 text-xs">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEditColumn(column);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
              >
                <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                Kolonu Düzenle
              </button>
              {onMoveColumn && canMoveLeft && (
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await onMoveColumn(column.id, -1);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-zinc-400" />
                  Sola Taşı
                </button>
              )}
              {onMoveColumn && canMoveRight && (
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await onMoveColumn(column.id, 1);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
                >
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                  Sağa Taşı
                </button>
              )}
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await onDeleteColumn(column);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Kolonu Sil
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline Quick Create */}
      {adding && (
        <form onSubmit={handleAdd} className="px-3 pb-2.5 space-y-2">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setAdding(false);
                setTitle('');
              }
            }}
            placeholder="Görev başlığı..."
            className="w-full px-3.5 py-2 text-xs rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setTitle('');
              }}
              className="px-2.5 py-1 rounded-full text-[11px] text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-3 py-1 rounded-full text-[11px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90"
            >
              Ekle
            </button>
          </div>
        </form>
      )}

      {/* Cards List */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-3 pb-2 space-y-2.5 min-h-[120px]"
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="h-24 rounded-2xl border border-dashed border-zinc-300/70 dark:border-zinc-700/60 flex items-center justify-center text-[11px] text-zinc-400 dark:text-zinc-500 select-none">
              Görev yok — buraya sürükleyin
            </div>
          ) : (
            tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                subtasks={allTasks.filter((t) => t.parentId === task.id)}
                isCritical={criticalTaskIds?.has(task.id)}
                onClick={() => onSelectTask(task)}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Bottom Quick Add Trigger */}
      {!adding && (
        <div className="px-3 pb-3 pt-1">
          <button
            onClick={() => setAdding(true)}
            className="w-full py-2 px-3 rounded-2xl text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/70 flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Görev ekle
          </button>
        </div>
      )}
    </div>
  );
}
