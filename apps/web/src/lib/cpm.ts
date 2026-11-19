import type { CriticalPathResult, Task } from '../types/pmam';

const MS_PER_DAY = 86_400_000;

function toDayIndex(d: Date | string): number {
  const dt = new Date(d);
  return Math.floor(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) / MS_PER_DAY);
}

/**
 * Client-side CPM calculation matching the backend scheduler-math engine,
 * used for instant live updates during Gantt drag/resize interactions.
 */
export function computeLiveCriticalPath(tasks: Task[]): CriticalPathResult {
  if (tasks.length === 0) {
    return { projectDurationDays: 0, criticalTaskIds: [], nodes: {} };
  }

  const durationMap = new Map<string, number>();
  const scheduledStartMap = new Map<string, number>();
  const taskIds = new Set(tasks.map((t) => t.id));
  let minStartDay = Infinity;
  for (const t of tasks) {
    const s = toDayIndex(t.startDate);
    if (s < minStartDay) minStartDay = s;
  }
  for (const t of tasks) {
    scheduledStartMap.set(t.id, toDayIndex(t.startDate) - minStartDay);
    if (t.isMilestone) {
      durationMap.set(t.id, 0);
    } else {
      const diff = Math.max(1, toDayIndex(t.dueDate) - toDayIndex(t.startDate) + 1);
      durationMap.set(t.id, diff);
    }
  }

  interface DepEdge {
    predecessorId: string;
    successorId: string;
    type: string;
    lagDays: number;
  }

  const seenDeps = new Set<string>();
  const validDeps: DepEdge[] = [];
  for (const t of tasks) {
    for (const d of t.predecessorLinks ?? []) {
      if (taskIds.has(d.predecessorId) && taskIds.has(d.successorId) && !seenDeps.has(d.id)) {
        seenDeps.add(d.id);
        validDeps.push(d);
      }
    }
  }

  const preds = new Map<string, DepEdge[]>();
  const succs = new Map<string, DepEdge[]>();
  const inDegree = new Map<string, number>();
  for (const id of taskIds) {
    preds.set(id, []);
    succs.set(id, []);
    inDegree.set(id, 0);
  }
  for (const d of validDeps) {
    succs.get(d.predecessorId)!.push(d);
    preds.get(d.successorId)!.push(d);
    inDegree.set(d.successorId, (inDegree.get(d.successorId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }
  const topo: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    topo.push(u);
    for (const d of succs.get(u) ?? []) {
      const nextDeg = (inDegree.get(d.successorId) ?? 1) - 1;
      inDegree.set(d.successorId, nextDeg);
      if (nextDeg === 0) queue.push(d.successorId);
    }
  }
  for (const id of taskIds) {
    if (!topo.includes(id)) topo.push(id);
  }

  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  const drivingPreds = new Map<string, string[]>();

  for (const id of topo) {
    const dur = durationMap.get(id) ?? 0;
    const schedStart = scheduledStartMap.get(id) ?? 0;
    let maxPredConstraint = -Infinity;
    const predCandidates: { predId: string; val: number }[] = [];

    for (const d of preds.get(id) ?? []) {
      const pEs = es.get(d.predecessorId) ?? 0;
      const pEf = ef.get(d.predecessorId) ?? 0;
      const lag = d.lagDays ?? 0;
      let candidateEs = 0;
      if (d.type === 'FS') candidateEs = pEf + lag;
      else if (d.type === 'SS') candidateEs = pEs + lag;
      else if (d.type === 'FF') candidateEs = pEf + lag - dur;
      else if (d.type === 'SF') candidateEs = pEs + lag - dur;
      predCandidates.push({ predId: d.predecessorId, val: candidateEs });
      if (candidateEs > maxPredConstraint) maxPredConstraint = candidateEs;
    }

    const drivers = predCandidates
      .filter((c) => c.val === maxPredConstraint)
      .map((c) => c.predId);
    drivingPreds.set(id, drivers);

    const nodeEs = Math.max(schedStart, maxPredConstraint === -Infinity ? 0 : maxPredConstraint);
    es.set(id, nodeEs);
    ef.set(id, nodeEs + dur);
  }

  let projectDurationDays = 0;
  for (const val of ef.values()) {
    if (val > projectDurationDays) projectDurationDays = val;
  }

  const criticalSet = new Set<string>();
  const critStack: string[] = [];
  for (const id of topo) {
    if ((ef.get(id) ?? 0) === projectDurationDays) {
      critStack.push(id);
    }
  }
  while (critStack.length > 0) {
    const cur = critStack.pop()!;
    if (criticalSet.has(cur)) continue;
    criticalSet.add(cur);
    for (const pId of drivingPreds.get(cur) ?? []) {
      if (!criticalSet.has(pId)) critStack.push(pId);
    }
  }

  const ls = new Map<string, number>();
  const lf = new Map<string, number>();
  for (let i = topo.length - 1; i >= 0; i--) {
    const id = topo[i];
    const dur = durationMap.get(id) ?? 0;
    const out = succs.get(id) ?? [];
    let minLf = projectDurationDays;
    if (out.length > 0) {
      minLf = Infinity;
      for (const d of out) {
        const sLs = ls.get(d.successorId) ?? projectDurationDays;
        const sLf = lf.get(d.successorId) ?? projectDurationDays;
        const lag = d.lagDays ?? 0;
        let candidateLf = projectDurationDays;
        if (d.type === 'FS') candidateLf = sLs - lag;
        else if (d.type === 'SS') candidateLf = sLs - lag + dur;
        else if (d.type === 'FF') candidateLf = sLf - lag;
        else if (d.type === 'SF') candidateLf = sLf - lag + dur;
        if (candidateLf < minLf) minLf = candidateLf;
      }
    }
    lf.set(id, minLf);
    ls.set(id, minLf - dur);
  }

  const nodes: CriticalPathResult['nodes'] = {};
  const criticalTaskIds: string[] = [];
  for (const id of topo) {
    const dur = durationMap.get(id) ?? 0;
    const earlyStart = es.get(id) ?? 0;
    const earlyFinish = ef.get(id) ?? 0;
    const lateStart = ls.get(id) ?? 0;
    const lateFinish = lf.get(id) ?? 0;
    const slackDays = Math.round((lateStart - earlyStart) * 100) / 100;
    const isCritical = criticalSet.has(id);
    if (isCritical) criticalTaskIds.push(id);
    nodes[id] = {
      durationDays: dur,
      earlyStart,
      earlyFinish,
      lateStart,
      lateFinish,
      slackDays,
      isCritical,
    };
  }

  return { projectDurationDays, criticalTaskIds, nodes };
}
