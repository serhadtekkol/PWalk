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
import { Columns3, Flame, Plus, X } from 'lucide-react';
import type { BoardColumn, CriticalPathResult, Task, TaskStatus } from '../types/pmam';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

export interface ColumnPayload {
  name: string;
  mappedStatus: TaskStatus;
  color: string;
  wipLimit: number | null;
}

const COLUMN_COLORS = [
  { label: 'Gri', hex: '#64748b' },
  { label: 'Mavi', hex: '#3b82f6' },
  { label: 'İndigo', hex: '#6366f1' },
  { label: 'Mor', hex: '#8b5cf6' },
  { label: 'Camgöbeği', hex: '#06b6d4' },
  { label: 'Yeşil', hex: '#10b981' },
  { label: 'Kehribar', hex: '#f59e0b' },
  { label: 'Gül', hex: '#f43f5e' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'Yapılacak (TODO)' },
  { value: 'IN_PROGRESS', label: 'Devam Ediyor (IN PROGRESS)' },
  { value: 'REVIEW', label: 'İnceleme (REVIEW)' },
  { value: 'DONE', label: 'Tamamlandı (DONE)' },
];

export function KanbanBoard({
  columns,
  tasks,
  criticalPath,
  currentUserId,
  onMoveTask,
  onSelectTask,
  onQuickCreate,
  onAddColumn,
  onUpdateColumn,
  onDeleteColumn,
  onMoveColumn,
}: {
  columns: BoardColumn[];
  tasks: Task[];
  criticalPath?: CriticalPathResult | null;
  currentUserId?: string;
  onMoveTask: (taskId: string, columnId: string, order: number) => Promise<void>;
  onSelectTask: (task: Task) => void;
  onQuickCreate: (columnId: string, title: string) => Promise<void>;
  onAddColumn: (payload: ColumnPayload) => Promise<void>;
  onUpdateColumn: (columnId: string, payload: ColumnPayload) => Promise<void>;
  onDeleteColumn: (columnId: string) => Promise<void>;
  onMoveColumn?: (columnId: string, dir: -1 | 1) => Promise<void>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [highlightCritical, setHighlightCritical] = useState(true);
  const [quickFilter, setQuickFilter] = useState<'all' | 'mine' | 'critical' | 'overdue'>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const criticalSet = highlightCritical
    ? new Set(criticalPath?.criticalTaskIds ?? [])
    : new Set<string>();
  const rawCriticalSet = new Set(criticalPath?.criticalTaskIds ?? []);

  const visibleTasks = tasks.filter((t) => {
    if (quickFilter === 'mine' && currentUserId) return t.assigneeId === currentUserId;
    if (quickFilter === 'critical') return rawCriticalSet.has(t.id);
    if (quickFilter === 'overdue') return t.status !== 'DONE' && new Date(t.dueDate) < new Date();
    return true;
  });

  // Column create/edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<BoardColumn | null>(null);
  const [colName, setColName] = useState('');
  const [colStatus, setColStatus] = useState<TaskStatus>('TODO');
  const [colColor, setColColor] = useState('#3b82f6');
  const [colWip, setColWip] = useState('');
  const [savingCol, setSavingCol] = useState(false);

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  const openCreateModal = () => {
    setEditingColumn(null);
    setColName('');
    setColStatus('TODO');
    setColColor('#3b82f6');
    setColWip('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (col: BoardColumn) => {
    setEditingColumn(col);
    setColName(col.name);
    setColStatus(col.mappedStatus);
    setColColor(col.color || '#64748b');
    setColWip(col.wipLimit ? String(col.wipLimit) : '');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSaveColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colName.trim() || savingCol) return;
    setSavingCol(true);
    setErrorMsg(null);
    try {
      const parsedWip = colWip.trim() ? Number(colWip.trim()) : null;
      const payload: ColumnPayload = {
        name: colName.trim(),
        mappedStatus: colStatus,
        color: colColor,
        wipLimit: parsedWip && parsedWip > 0 ? Math.floor(parsedWip) : null,
      };
      if (editingColumn) {
        await onUpdateColumn(editingColumn.id, payload);
      } else {
        await onAddColumn(payload);
      }
      setModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Kolon kaydedilemedi.');
    } finally {
      setSavingCol(false);
    }
  };

  const handleDeleteColumn = async (col: BoardColumn) => {
    setErrorMsg(null);
    try {
      await onDeleteColumn(col.id);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Kolon silinemedi. Önce içindeki görevleri başka kolona taşıyın.');
    }
  };

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50/70 dark:bg-zinc-950">
      {/* Always-visible Board Subheader */}
      <div className="px-5 pt-3 pb-1 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
          <Columns3 className="w-3.5 h-3.5" />
          <span>
            <strong className="font-medium text-zinc-700 dark:text-zinc-200">{sortedColumns.length}</strong> kolon
          </span>
          <span>·</span>
          <span>
            <strong className="font-medium text-zinc-700 dark:text-zinc-200">{visibleTasks.length}</strong> görev
          </span>
          <div className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
            {(
              [
                { id: 'all', label: 'Tümü' },
                { id: 'mine', label: 'Bana Atananlar' },
                { id: 'critical', label: 'Kritik Yol' },
                { id: 'overdue', label: 'Gecikenler' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setQuickFilter(f.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  quickFilter === f.id
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                    : 'text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {criticalPath && criticalPath.criticalTaskIds.length > 0 && (
            <button
              onClick={() => setHighlightCritical((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition ${
                highlightCritical
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-800/70'
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 ring-1 ring-zinc-200/80 dark:ring-zinc-800'
              }`}
              title={`Toplam Kritik Yol Süresi: ${criticalPath.projectDurationDays} gün`}
            >
              <Flame className="w-3.5 h-3.5" />
              Kritik Yol ({criticalPath.criticalTaskIds.length}) · {criticalPath.projectDurationDays}g
            </button>
          )}

          <button
            onClick={openCreateModal}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 ring-1 ring-zinc-200/80 dark:ring-zinc-800 hover:ring-zinc-300 dark:hover:ring-zinc-700 shadow-2xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5 text-blue-500" />
            Yeni Kolon Ekle
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mx-5 mt-2 px-3.5 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="p-0.5 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Columns Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-5 pt-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full items-start">
            {sortedColumns.map((col, idx) => {
              const colTasks = visibleTasks
                .filter((t) => t.columnId === col.id)
                .sort((a, b) => a.order - b.order);
              return (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  tasks={colTasks}
                  allTasks={tasks}
                  criticalTaskIds={criticalSet}
                  canMoveLeft={idx > 0}
                  canMoveRight={idx < sortedColumns.length - 1}
                  onSelectTask={onSelectTask}
                  onQuickCreate={onQuickCreate}
                  onEditColumn={openEditModal}
                  onDeleteColumn={handleDeleteColumn}
                  onMoveColumn={onMoveColumn}
                />
              );
            })}

            <div className="w-64 shrink-0">
              <button
                onClick={openCreateModal}
                className="w-full py-3.5 px-4 rounded-3xl border border-dashed border-zinc-300/80 dark:border-zinc-800 text-xs font-medium text-zinc-500 hover:border-blue-400/60 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                Yeni Kolon Ekle
              </button>
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

      {/* Add / Edit Column Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSaveColumn}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {editingColumn ? 'Kolonu Düzenle' : 'Yeni Kolon Ekle'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Kolon Adı</label>
              <input
                autoFocus
                required
                type="text"
                value={colName}
                onChange={(e) => setColName(e.target.value)}
                placeholder="Örn: Test, Beklemede, Müşteri Onayı..."
                className="w-full px-3.5 py-2 text-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Durum Eşlemesi
              </label>
              <select
                value={colStatus}
                onChange={(e) => setColStatus(e.target.value as TaskStatus)}
                className="w-full px-3.5 py-2 text-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Kategori Rengi</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {COLUMN_COLORS.map((c) => {
                  const selected = colColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColColor(c.hex)}
                      title={c.label}
                      className={`w-7 h-7 rounded-full transition flex items-center justify-center ${
                        selected ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100 dark:ring-offset-zinc-900 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                WIP Limiti (Opsiyonel)
              </label>
              <input
                type="number"
                min={1}
                value={colWip}
                onChange={(e) => setColWip(e.target.value)}
                placeholder="Sınırsız bırakmak için boş bırakın"
                className="w-full px-3.5 py-2 text-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={savingCol}
                className="px-5 py-2 rounded-full text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-50"
              >
                {savingCol ? 'Kaydediliyor...' : editingColumn ? 'Güncelle' : 'Kolon Oluştur'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
