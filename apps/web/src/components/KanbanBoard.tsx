import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import type { BoardColumn, Task } from '../types/pmam';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

export function KanbanBoard({
  columns,
  tasks,
  onMoveTask,
  onSelectTask,
  onQuickCreate,
  onAddColumn,
}: {
  columns: BoardColumn[];
  tasks: Task[];
  onMoveTask: (taskId: string, columnId: string, order: number) => Promise<void>;
  onSelectTask: (task: Task) => void;
  onQuickCreate: (columnId: string, title: string) => Promise<void>;
  onAddColumn: (name: string) => Promise<void>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [newColName, setNewColName] = useState('');
  const [addingCol, setAddingCol] = useState(false);

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  const handleDragStart = (event: DragStartEvent) => {
    const t = tasks.find((x) => x.id === event.active.id);
    setActiveTask(t ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    const overId = String(over.id);
    let targetColumnId = draggedTask.columnId;
    let targetOrder = 0;

    if (overId.startsWith('col-')) {
      targetColumnId = overId.replace('col-', '');
      const colTasks = tasks.filter((t) => t.columnId === targetColumnId && t.id !== draggedTask.id);
      targetOrder = colTasks.length;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetColumnId = overTask.columnId;
        const colTasks = tasks
          .filter((t) => t.columnId === targetColumnId && t.id !== draggedTask.id)
          .sort((a, b) => a.order - b.order);
        const idx = colTasks.findIndex((t) => t.id === overTask.id);
        targetOrder = idx >= 0 ? idx : colTasks.length;
      }
    }

    if (targetColumnId !== draggedTask.columnId || targetOrder !== draggedTask.order) {
      await onMoveTask(draggedTask.id, targetColumnId, targetOrder);
    }
  };

  const handleCreateCol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    await onAddColumn(newColName.trim());
    setNewColName('');
    setAddingCol(false);
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden p-5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full items-start">
          {sortedColumns.map((col) => {
            const colTasks = tasks
              .filter((t) => t.columnId === col.id)
              .sort((a, b) => a.order - b.order);
            return (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={colTasks}
                allTasks={tasks}
                onSelectTask={onSelectTask}
                onQuickCreate={onQuickCreate}
              />
            );
          })}

          <div className="w-64 shrink-0">
            {addingCol ? (
              <form
                onSubmit={handleCreateCol}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2"
              >
                <input
                  autoFocus
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="Sütun adı..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setAddingCol(false)}
                    className="px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md"
                  >
                    Ekle
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingCol(true)}
                className="w-full py-3 px-4 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Yeni Sütun Ekle
              </button>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <KanbanCard
              task={activeTask}
              subtasks={tasks.filter((t) => t.parentId === activeTask.id)}
              onClick={() => {}}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
