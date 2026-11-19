import type { Task } from '../types/pmam';

export interface WbsRow {
  task: Task;
  wbs: string;
  depth: number;
  hasChildren: boolean;
}

export function buildWbsTree(tasks: Task[], collapsedIds: Set<string>): WbsRow[] {
  const byParent = new Map<string | null, Task[]>();
  const taskIds = new Set(tasks.map((t) => t.id));

  for (const t of tasks) {
    const pid = t.parentId && taskIds.has(t.parentId) ? t.parentId : null;
    const list = byParent.get(pid) ?? [];
    list.push(t);
    byParent.set(pid, list);
  }

  const rows: WbsRow[] = [];

  function walk(parentId: string | null, prefix: string, depth: number) {
    const children = byParent.get(parentId) ?? [];
    children.forEach((task, idx) => {
      const wbs = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
      const sub = byParent.get(task.id) ?? [];
      const hasChildren = sub.length > 0;
      rows.push({ task, wbs, depth, hasChildren });
      if (hasChildren && !collapsedIds.has(task.id)) {
        walk(task.id, wbs, depth + 1);
      }
    });
  }

  walk(null, '', 0);
  return rows;
}
