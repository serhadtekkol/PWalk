import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Diamond, Flame } from 'lucide-react';
import type { CriticalPathResult, Task } from '../types/pmam';
import { buildWbsTree } from '../lib/wbs';

type ZoomMode = 'day' | 'week' | 'month';
const ZOOM_PX: Record<ZoomMode, number> = { day: 36, week: 16, month: 6 };
const ROW_H = 38;
const MS_PER_DAY = 86_400_000;

function startOfDayUtc(d: Date | string): number {
  const dt = new Date(d);
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

export function GanttView({
  tasks,
  criticalPath,
  onSelectTask,
  onUpdateDates,
}: {
  tasks: Task[];
  criticalPath: CriticalPathResult | null;
  onSelectTask: (task: Task) => void;
  onUpdateDates: (taskId: string, startDate: string, dueDate: string) => Promise<void>;
}) {
  const [zoom, setZoom] = useState<ZoomMode>('day');
  const [showCritical, setShowCritical] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<{
    taskId: string;
    mode: 'move' | 'resize';
    startX: number;
    deltaDays: number;
    origStartMs: number;
    origEndMs: number;
  } | null>(null);

  const pxPerDay = ZOOM_PX[zoom];
  const rows = useMemo(() => buildWbsTree(tasks, collapsed), [tasks, collapsed]);

  const { timelineStartMs, totalDays } = useMemo(() => {
    const today = startOfDayUtc(new Date());
    if (tasks.length === 0) {
      return { timelineStartMs: today - 5 * MS_PER_DAY, totalDays: 30 };
    }
    let minMs = today;
    let maxMs = today;
    for (const t of tasks) {
      const s = startOfDayUtc(t.startDate);
      const e = startOfDayUtc(t.dueDate);
      if (s < minMs) minMs = s;
      if (e > maxMs) maxMs = e;
    }
    const start = minMs - 5 * MS_PER_DAY;
    const end = maxMs + 10 * MS_PER_DAY;
    return {
      timelineStartMs: start,
      totalDays: Math.max(21, Math.ceil((end - start) / MS_PER_DAY) + 1),
    };
  }, [tasks]);

  const todayMs = startOfDayUtc(new Date());
  const todayX = ((todayMs - timelineStartMs) / MS_PER_DAY) * pxPerDay;
  const criticalSet = new Set(criticalPath?.criticalTaskIds ?? []);

  const rowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r, idx) => map.set(r.task.id, idx));
    return map;
  }, [rows]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;
    const deltaDays = Math.round((e.clientX - dragState.startX) / pxPerDay);
    if (deltaDays !== dragState.deltaDays) {
      setDragState({ ...dragState, deltaDays });
    }
  };

  const handleMouseUp = async () => {
    if (!dragState) return;
    const { taskId, mode, deltaDays, origStartMs, origEndMs } = dragState;
    setDragState(null);
    if (deltaDays === 0) return;

    let nextStart = origStartMs;
    let nextEnd = origEndMs;
    if (mode === 'move') {
      nextStart += deltaDays * MS_PER_DAY;
      nextEnd += deltaDays * MS_PER_DAY;
    } else {
      nextEnd = Math.max(origStartMs, origEndMs + deltaDays * MS_PER_DAY);
    }
    await onUpdateDates(taskId, new Date(nextStart).toISOString(), new Date(nextEnd).toISOString());
  };

  const dayHeaders = useMemo(() => {
    const list: { label: string; x: number; isWeekend: boolean }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const ms = timelineStartMs + i * MS_PER_DAY;
      const d = new Date(ms);
      const dayOfWeek = d.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const showLabel =
        zoom === 'day' || (zoom === 'week' && dayOfWeek === 1) || (zoom === 'month' && d.getUTCDate() === 1);
      list.push({
        label: showLabel
          ? d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
          : '',
        x: i * pxPerDay,
        isWeekend,
      });
    }
    return list;
  }, [totalDays, timelineStartMs, pxPerDay, zoom]);

  const getBarCoords = (t: Task) => {
    let sMs = startOfDayUtc(t.startDate);
    let eMs = startOfDayUtc(t.dueDate);
    if (dragState && dragState.taskId === t.id) {
      if (dragState.mode === 'move') {
        sMs += dragState.deltaDays * MS_PER_DAY;
        eMs += dragState.deltaDays * MS_PER_DAY;
      } else {
        eMs = Math.max(sMs, eMs + dragState.deltaDays * MS_PER_DAY);
      }
    }
    const left = ((sMs - timelineStartMs) / MS_PER_DAY) * pxPerDay;
    const spanDays = Math.max(1, (eMs - sMs) / MS_PER_DAY + 1);
    const width = t.isMilestone ? 18 : Math.max(18, spanDays * pxPerDay);
    return { left, width };
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Toolbar */}
      <div className="h-11 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900/40 shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 font-medium">Ölçek:</span>
          {(['day', 'week', 'month'] as ZoomMode[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-2.5 py-1 rounded-md capitalize transition ${
                zoom === z
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {z === 'day' ? 'Gün' : z === 'week' ? 'Hafta' : 'Ay'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {criticalPath && (
            <span className="text-zinc-500">
              Proje Süresi: <strong className="text-zinc-900 dark:text-zinc-100">{criticalPath.projectDurationDays} gün</strong>
            </span>
          )}
          <button
            onClick={() => setShowCritical((v) => !v)}
            className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 font-medium transition ${
              showCritical
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Kritik Yolu Göster
          </button>
        </div>
      </div>

      {/* Split Pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: WBS Table */}
        <div className="w-[460px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 overflow-y-auto">
          <div className="h-9 border-b border-zinc-200 dark:border-zinc-800 px-3 flex items-center text-[11px] font-semibold text-zinc-500 uppercase tracking-wider sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10">
            <span className="w-12">WBS</span>
            <span className="flex-1">Görev</span>
            <span className="w-20 text-right">Başlangıç</span>
            <span className="w-20 text-right">Bitiş</span>
            <span className="w-10 text-right">%</span>
          </div>

          {rows.map(({ task, wbs, depth, hasChildren }) => {
            const isCrit = showCritical && criticalSet.has(task.id);
            return (
              <div
                key={task.id}
                style={{ height: ROW_H }}
                className={`px-3 flex items-center text-xs border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer ${
                  isCrit ? 'bg-red-50/40 dark:bg-red-950/10' : ''
                }`}
                onClick={() => onSelectTask(task)}
              >
                <span className="w-12 font-mono text-[11px] text-zinc-400">{wbs}</span>
                <div className="flex-1 flex items-center gap-1 min-w-0" style={{ paddingLeft: depth * 14 }}>
                  {hasChildren ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapse(task.id);
                      }}
                      className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                      {collapsed.has(task.id) ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}
                  {task.isMilestone && <Diamond className="w-3 h-3 text-amber-500 shrink-0" />}
                  <span className={`truncate font-medium ${isCrit ? 'text-red-700 dark:text-red-300' : ''}`}>
                    {task.title}
                  </span>
                </div>
                <span className="w-20 text-right text-[11px] text-zinc-500">
                  {new Date(task.startDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className="w-20 text-right text-[11px] text-zinc-500">
                  {new Date(task.dueDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className="w-10 text-right font-mono text-[11px] text-zinc-500">%{task.progress}</span>
              </div>
            );
          })}
        </div>

        {/* Right: Timeline */}
        <div className="flex-1 overflow-auto relative bg-zinc-50/50 dark:bg-zinc-950">
          <div style={{ width: totalDays * pxPerDay, minHeight: '100%' }} className="relative">
            {/* Header */}
            <div className="h-9 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10 relative">
              {dayHeaders.map((h, i) => (
                <div
                  key={i}
                  style={{ left: h.x, width: pxPerDay }}
                  className={`absolute top-0 bottom-0 border-r border-zinc-200/60 dark:border-zinc-800/60 px-1 flex items-center text-[10px] text-zinc-500 ${
                    h.isWeekend ? 'bg-zinc-100/70 dark:bg-zinc-800/30' : ''
                  }`}
                >
                  {h.label}
                </div>
              ))}
            </div>

            {/* Today vertical line */}
            {todayX >= 0 && (
              <div
                style={{ left: todayX }}
                className="absolute top-9 bottom-0 w-px bg-blue-500 z-10 pointer-events-none"
              />
            )}

            {/* SVG Dependency Arrows */}
            <svg
              width={totalDays * pxPerDay}
              height={Math.max(200, rows.length * ROW_H)}
              className="absolute top-9 left-0 pointer-events-none z-0"
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
                </marker>
                <marker id="arrow-crit" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                </marker>
              </defs>
              {rows.flatMap(({ task }) =>
                (task.predecessorLinks ?? []).map((dep) => {
                  const pIdx = rowIndexMap.get(dep.predecessorId);
                  const sIdx = rowIndexMap.get(dep.successorId);
                  if (pIdx === undefined || sIdx === undefined) return null;
                  const pTask = rows[pIdx].task;
                  const sTask = rows[sIdx].task;
                  const pBar = getBarCoords(pTask);
                  const sBar = getBarCoords(sTask);

                  const startX = dep.type === 'SS' || dep.type === 'SF' ? pBar.left : pBar.left + pBar.width;
                  const endX = dep.type === 'FF' || dep.type === 'SF' ? sBar.left + sBar.width : sBar.left;
                  const startY = pIdx * ROW_H + ROW_H / 2;
                  const endY = sIdx * ROW_H + ROW_H / 2;
                  const midX = startX + 12;

                  const isCritEdge = showCritical && criticalSet.has(pTask.id) && criticalSet.has(sTask.id);

                  return (
                    <path
                      key={dep.id}
                      d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
                      fill="none"
                      stroke={isCritEdge ? '#ef4444' : '#94a3b8'}
                      strokeWidth={isCritEdge ? 1.8 : 1.2}
                      markerEnd={isCritEdge ? 'url(#arrow-crit)' : 'url(#arrow)'}
                    />
                  );
                }),
              )}
            </svg>

            {/* Task Bars */}
            <div className="relative">
              {rows.map(({ task }) => {
                const { left, width } = getBarCoords(task);
                const isCrit = showCritical && criticalSet.has(task.id);

                return (
                  <div
                    key={task.id}
                    style={{ height: ROW_H }}
                    className="relative border-b border-zinc-100 dark:border-zinc-800/40"
                  >
                    {task.isMilestone ? (
                      <div
                        style={{ left: left - 9, top: 10 }}
                        onClick={() => onSelectTask(task)}
                        className={`absolute w-[18px] h-[18px] rotate-45 cursor-pointer border-2 ${
                          isCrit
                            ? 'bg-red-500 border-red-700'
                            : 'bg-amber-400 border-amber-600'
                        }`}
                        title={`${task.code}: ${task.title}`}
                      />
                    ) : (
                      <div
                        style={{ left, width, top: 7, height: 24 }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDragState({
                            taskId: task.id,
                            mode: 'move',
                            startX: e.clientX,
                            deltaDays: 0,
                            origStartMs: startOfDayUtc(task.startDate),
                            origEndMs: startOfDayUtc(task.dueDate),
                          });
                        }}
                        onClick={() => onSelectTask(task)}
                        className={`group absolute rounded-md cursor-grab active:cursor-grabbing flex items-center px-2 text-[11px] font-medium text-white shadow-xs overflow-hidden ${
                          isCrit
                            ? 'bg-red-600 ring-2 ring-red-400/50'
                            : 'bg-zinc-800 dark:bg-blue-600'
                        }`}
                        title={`${task.code} (${task.progress}%)`}
                      >
                        {/* Progress overlay */}
                        <div
                          className="absolute inset-y-0 left-0 bg-white/20 pointer-events-none"
                          style={{ width: `${task.progress}%` }}
                        />
                        <span className="relative z-10 truncate">{task.code}</span>

                        {/* Resize handle */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDragState({
                              taskId: task.id,
                              mode: 'resize',
                              startX: e.clientX,
                              deltaDays: 0,
                              origStartMs: startOfDayUtc(task.startDate),
                              origEndMs: startOfDayUtc(task.dueDate),
                            });
                          }}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
