export interface CpmTaskInput {
  id: string;
  startDate: Date | string;
  dueDate: Date | string;
  isMilestone: boolean;
}

export interface CpmDepInput {
  predecessorId: string;
  successorId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF' | string;
  lagDays: number;
}

export interface CpmNodeResult {
  durationDays: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slackDays: number;
  isCritical: boolean;
}

export interface CpmResult {
  projectDurationDays: number;
  criticalTaskIds: string[];
  nodes: Record<string, CpmNodeResult>;
}

const MS_PER_DAY = 86_400_000;

function toDayIndex(d: Date | string): number {
  const dt = new Date(d);
  return Math.floor(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) / MS_PER_DAY);
}

export function wouldCreateCycle(
  edges: { predecessorId: string; successorId: string }[],
  predecessorId: string,
  successorId: string,
): boolean {
  if (predecessorId === successorId) return true;
  // Adding edge predecessor -> successor creates a cycle iff predecessor is reachable from successor
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.predecessorId) ?? [];
    list.push(e.successorId);
    adj.set(e.predecessorId, list);
  }
  const visited = new Set<string>();
  const stack = [successorId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === predecessorId) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of adj.get(cur) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

export function computeCriticalPath(tasks: CpmTaskInput[], dependencies: CpmDepInput[]): CpmResult {
  if (tasks.length === 0) {
    return { projectDurationDays: 0, criticalTaskIds: [], nodes: {} };
  }

  const durationMap = new Map<string, number>();
  const taskIds = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    if (t.isMilestone) {
      durationMap.set(t.id, 0);
    } else {
      const diff = Math.max(1, toDayIndex(t.dueDate) - toDayIndex(t.startDate));
      durationMap.set(t.id, diff);
    }
  }

  const validDeps = dependencies.filter((d) => taskIds.has(d.predecessorId) && taskIds.has(d.successorId));
  const preds = new Map<string, CpmDepInput[]>();
  const succs = new Map<string, CpmDepInput[]>();
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

  // Kahn's topological sort
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
  // Fallback for any disconnected/cyclic leftovers
  for (const id of taskIds) {
    if (!topo.includes(id)) topo.push(id);
  }

  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  for (const id of topo) {
    const dur = durationMap.get(id) ?? 0;
    let maxEs = 0;
    for (const d of preds.get(id) ?? []) {
      const pEs = es.get(d.predecessorId) ?? 0;
      const pEf = ef.get(d.predecessorId) ?? 0;
      const lag = d.lagDays ?? 0;
      let candidateEs = 0;
      if (d.type === 'FS') candidateEs = pEf + lag;
      else if (d.type === 'SS') candidateEs = pEs + lag;
      else if (d.type === 'FF') candidateEs = pEf + lag - dur;
      else if (d.type === 'SF') candidateEs = pEs + lag - dur;
      if (candidateEs > maxEs) maxEs = candidateEs;
    }
    es.set(id, maxEs);
    ef.set(id, maxEs + dur);
  }

  let projectDurationDays = 0;
  for (const val of ef.values()) {
    if (val > projectDurationDays) projectDurationDays = val;
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

  const nodes: Record<string, CpmNodeResult> = {};
  const criticalTaskIds: string[] = [];
  for (const id of topo) {
    const dur = durationMap.get(id) ?? 0;
    const earlyStart = es.get(id) ?? 0;
    const earlyFinish = ef.get(id) ?? 0;
    const lateStart = ls.get(id) ?? 0;
    const lateFinish = lf.get(id) ?? 0;
    const slackDays = Math.round((lateStart - earlyStart) * 100) / 100;
    const isCritical = slackDays <= 0;
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

export interface WorkloadTaskInput {
  id: string;
  assigneeId: string | null;
  startDate: Date | string;
  dueDate: Date | string;
  estimatedHours: number;
  isMilestone: boolean;
  status: string;
}

export interface WorkloadMemberInput {
  id: string;
  name: string;
  avatarColor: string;
  dailyCapacityHours: number;
}

export interface WorkloadDay {
  date: string;
  allocatedHours: number;
  overloaded: boolean;
}

export interface WorkloadReport {
  days: string[];
  members: {
    userId: string;
    name: string;
    avatarColor: string;
    dailyCapacityHours: number;
    days: WorkloadDay[];
  }[];
}

export function computeWorkload(
  tasks: WorkloadTaskInput[],
  members: WorkloadMemberInput[],
  from: Date,
  to: Date,
): WorkloadReport {
  const startDay = toDayIndex(from);
  const endDay = Math.max(startDay, toDayIndex(to));
  const days: string[] = [];
  for (let d = startDay; d <= endDay; d++) {
    days.push(new Date(d * MS_PER_DAY).toISOString().slice(0, 10));
  }

  const memberReports = members.map((m) => {
    const hoursByDay = new Map<number, number>();
    const memberTasks = tasks.filter((t) => t.assigneeId === m.id && !t.isMilestone && t.status !== 'DONE');

    for (const t of memberTasks) {
      const tStart = toDayIndex(t.startDate);
      const tEnd = Math.max(tStart, toDayIndex(t.dueDate));
      const spanDays = tEnd - tStart + 1;
      const dailyHours = t.estimatedHours / spanDays;
      for (let d = Math.max(startDay, tStart); d <= Math.min(endDay, tEnd); d++) {
        hoursByDay.set(d, (hoursByDay.get(d) ?? 0) + dailyHours);
      }
    }

    const dayEntries: WorkloadDay[] = [];
    for (let d = startDay; d <= endDay; d++) {
      const allocatedHours = Math.round((hoursByDay.get(d) ?? 0) * 100) / 100;
      dayEntries.push({
        date: new Date(d * MS_PER_DAY).toISOString().slice(0, 10),
        allocatedHours,
        overloaded: allocatedHours > m.dailyCapacityHours,
      });
    }

    return {
      userId: m.id,
      name: m.name,
      avatarColor: m.avatarColor,
      dailyCapacityHours: m.dailyCapacityHours,
      days: dayEntries,
    };
  });

  return { days, members: memberReports };
}
