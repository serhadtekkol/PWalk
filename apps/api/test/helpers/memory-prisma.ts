import { randomUUID } from 'node:crypto';

type Row = Record<string, any>;

function matchWhere(row: Row, where?: Row): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (k === 'AND' && Array.isArray(v)) {
      if (!v.every((sub) => matchWhere(row, sub))) return false;
      continue;
    }
    if (k === 'OR' && Array.isArray(v)) {
      if (!v.some((sub) => matchWhere(row, sub))) return false;
      continue;
    }
    if (k.includes('_') && typeof v === 'object' && v !== null && !Array.isArray(v)) {
      // Composite unique key e.g. projectId_userId
      const ok = Object.entries(v).every(([ck, cv]) => row[ck] === cv);
      if (!ok) return false;
      continue;
    }
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v && Array.isArray(v.in)) {
        if (!v.in.includes(row[k])) return false;
        continue;
      }
      if ('not' in v) {
        if (row[k] === v.not) return false;
        continue;
      }
      if ('lte' in v) {
        if (!(new Date(row[k]).getTime() <= new Date(v.lte).getTime())) return false;
      }
      if ('lt' in v) {
        if (!(new Date(row[k]).getTime() < new Date(v.lt).getTime())) return false;
      }
      if ('gte' in v) {
        if (!(new Date(row[k]).getTime() >= new Date(v.gte).getTime())) return false;
      }
      if ('gt' in v) {
        if (!(new Date(row[k]).getTime() > new Date(v.gt).getTime())) return false;
      }
      if ('contains' in v) {
        if (!String(row[k] ?? '').toLowerCase().includes(String(v.contains).toLowerCase())) return false;
      }
      if ('some' in v) {
        // relation filter handled only at top level if needed
        continue;
      }
      continue;
    }
    if (row[k] !== v) return false;
  }
  return true;
}

function applySelectOrInclude(
  table: string,
  row: Row,
  db: Record<string, Row[]>,
  args?: { select?: Row; include?: Row },
): Row {
  let out: Row = { ...row };
  if (args?.include) {
    for (const [rel, val] of Object.entries(args.include)) {
      if (!val) continue;
      if (table === 'projectMember' && rel === 'user') {
        const u = db.user.find((x) => x.id === row.userId) ?? null;
        out.user = u ? applySelectOrInclude('user', u, db, typeof val === 'object' ? val : undefined) : null;
      } else if (table === 'projectMember' && rel === 'project') {
        out.project = db.project.find((x) => x.id === row.projectId) ?? null;
      } else if (table === 'project' && rel === 'columns') {
        out.columns = db.boardColumn
          .filter((c) => c.projectId === row.id)
          .sort((a, b) => a.order - b.order);
      } else if (table === 'project' && rel === 'members') {
        out.members = db.projectMember
          .filter((m) => m.projectId === row.id)
          .map((m) => applySelectOrInclude('projectMember', m, db, typeof val === 'object' ? val : undefined));
      } else if (table === 'task' && rel === 'assignee') {
        const u = row.assigneeId ? db.user.find((x) => x.id === row.assigneeId) ?? null : null;
        out.assignee = u ? applySelectOrInclude('user', u, db, typeof val === 'object' ? val : undefined) : null;
      } else if (table === 'task' && rel === 'creator') {
        const u = db.user.find((x) => x.id === row.creatorId) ?? null;
        out.creator = u ? applySelectOrInclude('user', u, db, typeof val === 'object' ? val : undefined) : null;
      } else if (table === 'task' && rel === 'project') {
        out.project = db.project.find((x) => x.id === row.projectId) ?? null;
      } else if (table === 'task' && rel === 'subtasks') {
        out.subtasks = db.task.filter((t) => t.parentId === row.id);
      } else if (table === 'task' && rel === 'predecessorLinks') {
        out.predecessorLinks = db.taskDependency.filter((d) => d.successorId === row.id);
      } else if (table === 'task' && rel === 'successorLinks') {
        out.successorLinks = db.taskDependency.filter((d) => d.predecessorId === row.id);
      } else if (table === 'taskComment' && rel === 'user') {
        const u = db.user.find((x) => x.id === row.userId) ?? null;
        out.user = u ? applySelectOrInclude('user', u, db, typeof val === 'object' ? val : undefined) : null;
      } else if (table === 'taskActivity' && rel === 'user') {
        const u = db.user.find((x) => x.id === row.userId) ?? null;
        out.user = u ? applySelectOrInclude('user', u, db, typeof val === 'object' ? val : undefined) : null;
      } else if (table === 'reminder' && rel === 'task') {
        out.task = db.task.find((t) => t.id === row.taskId) ?? null;
      }
    }
  }
  if (args?.select) {
    const selected: Row = {};
    for (const [k, v] of Object.entries(args.select)) {
      if (v) selected[k] = out[k];
    }
    out = selected;
  }
  return out;
}

const defaults: Record<string, () => Row> = {
  user: () => ({
    avatarColor: '#2563eb',
    role: 'MEMBER',
    dailyCapacityHours: 8,
    ntfyTopic: null,
  }),
  refreshToken: () => ({ revokedAt: null }),
  project: () => ({ description: null, color: '#0f172a', status: 'ACTIVE', taskSeq: 0 }),
  projectMember: () => ({ role: 'EDITOR' }),
  boardColumn: () => ({ wipLimit: null, mappedStatus: 'TODO', color: null }),
  task: () => ({
    parentId: null,
    order: 0,
    description: null,
    priority: 'MEDIUM',
    status: 'TODO',
    estimatedHours: 8,
    progress: 0,
    isMilestone: false,
    assigneeId: null,
    tags: null,
    baselineStartDate: null,
    baselineDueDate: null,
  }),
  taskDependency: () => ({ type: 'FS', lagDays: 0 }),
  taskComment: () => ({}),
  taskActivity: () => ({ metadata: null }),
  reminder: () => ({ message: null, sentAt: null }),
  notification: () => ({ taskId: null, isRead: false }),
  pushSubscription: () => ({ platform: 'WEB', endpoint: null, p256dh: null, auth: null, deviceToken: null }),
};

export function createMemoryPrisma() {
  const db: Record<string, Row[]> = {
    user: [],
    refreshToken: [],
    project: [],
    projectMember: [],
    boardColumn: [],
    task: [],
    taskDependency: [],
    taskComment: [],
    taskActivity: [],
    reminder: [],
    notification: [],
    pushSubscription: [],
  };

  function makeModel(table: string) {
    const rows = () => db[table];
    return {
      async count(args?: { where?: Row }) {
        return rows().filter((r) => matchWhere(r, args?.where)).length;
      },
      async findUnique(args: { where: Row; select?: Row; include?: Row }) {
        const found = rows().find((r) => matchWhere(r, args.where)) ?? null;
        return found ? applySelectOrInclude(table, found, db, args) : null;
      },
      async findFirst(args?: { where?: Row; select?: Row; include?: Row; orderBy?: Row }) {
        let list = rows().filter((r) => matchWhere(r, args?.where));
        if (args?.orderBy) {
          const [ok, dir] = Object.entries(args.orderBy)[0];
          list = [...list].sort((a, b) => (a[ok] > b[ok] ? 1 : -1) * (dir === 'desc' ? -1 : 1));
        }
        const found = list[0] ?? null;
        return found ? applySelectOrInclude(table, found, db, args) : null;
      },
      async findMany(args?: { where?: Row; select?: Row; include?: Row; orderBy?: Row | Row[] }) {
        let list = rows().filter((r) => {
          if (table === 'project' && args?.where?.members?.some) {
            const cond = args.where.members.some;
            const has = db.projectMember.some((m) => m.projectId === r.id && matchWhere(m, cond));
            if (!has) return false;
            const { members: _m, ...rest } = args.where;
            return matchWhere(r, rest);
          }
          return matchWhere(r, args?.where);
        });
        if (args?.orderBy) {
          const orders = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
          list = [...list].sort((a, b) => {
            for (const o of orders) {
              const [ok, dir] = Object.entries(o)[0];
              if (a[ok] !== b[ok]) return (a[ok] > b[ok] ? 1 : -1) * (dir === 'desc' ? -1 : 1);
            }
            return 0;
          });
        }
        return list.map((r) => applySelectOrInclude(table, r, db, args));
      },
      async create(args: { data: Row; select?: Row; include?: Row }) {
        const now = new Date();
        const row: Row = {
          id: randomUUID(),
          ...(defaults[table]?.() ?? {}),
          createdAt: now,
          updatedAt: now,
          ...args.data,
        };
        if (row.taskSeq && typeof row.taskSeq === 'object' && 'increment' in row.taskSeq) {
          row.taskSeq = row.taskSeq.increment;
        }
        rows().push(row);
        return applySelectOrInclude(table, row, db, args);
      },
      async createMany(args: { data: Row[] }) {
        for (const d of args.data) {
          await this.create({ data: d });
        }
        return { count: args.data.length };
      },
      async update(args: { where: Row; data: Row; select?: Row; include?: Row }) {
        const idx = rows().findIndex((r) => matchWhere(r, args.where));
        if (idx === -1) throw new Error(`Record not found in ${table}`);
        const next = { ...rows()[idx], updatedAt: new Date() };
        for (const [k, v] of Object.entries(args.data)) {
          if (v !== null && typeof v === 'object' && 'increment' in v) {
            next[k] = (next[k] ?? 0) + v.increment;
          } else if (v !== undefined) {
            next[k] = v;
          }
        }
        rows()[idx] = next;
        return applySelectOrInclude(table, next, db, args);
      },
      async updateMany(args: { where?: Row; data: Row }) {
        let count = 0;
        for (let i = 0; i < rows().length; i++) {
          if (matchWhere(rows()[i], args.where)) {
            rows()[i] = { ...rows()[i], ...args.data, updatedAt: new Date() };
            count++;
          }
        }
        return { count };
      },
      async delete(args: { where: Row }) {
        const idx = rows().findIndex((r) => matchWhere(r, args.where));
        if (idx === -1) throw new Error(`Record not found in ${table}`);
        const [removed] = rows().splice(idx, 1);
        return removed;
      },
      async deleteMany(args?: { where?: Row }) {
        const before = rows().length;
        db[table] = rows().filter((r) => !matchWhere(r, args?.where));
        return { count: before - db[table].length };
      },
    };
  }

  const client: any = {
    user: makeModel('user'),
    refreshToken: makeModel('refreshToken'),
    project: makeModel('project'),
    projectMember: makeModel('projectMember'),
    boardColumn: makeModel('boardColumn'),
    task: makeModel('task'),
    taskDependency: makeModel('taskDependency'),
    taskComment: makeModel('taskComment'),
    taskActivity: makeModel('taskActivity'),
    reminder: makeModel('reminder'),
    notification: makeModel('notification'),
    pushSubscription: makeModel('pushSubscription'),
    async $transaction(fnOrArray: any) {
      if (typeof fnOrArray === 'function') {
        return fnOrArray(client);
      }
      return Promise.all(fnOrArray);
    },
  };
  return client;
}
