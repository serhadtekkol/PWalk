import { describe, it, expect } from 'vitest';
import { buildWbsTree } from './wbs';
import type { Task } from '../types/pmam';

function makeTask(id: string, parentId: string | null, title: string): Task {
  return {
    id,
    projectId: 'p1',
    code: `PM-${id}`,
    parentId,
    columnId: 'c1',
    order: 0,
    title,
    description: null,
    priority: 'MEDIUM',
    status: 'TODO',
    startDate: '2026-11-17T00:00:00Z',
    dueDate: '2026-11-20T00:00:00Z',
    estimatedHours: 8,
    progress: 0,
    isMilestone: false,
    assigneeId: null,
    creatorId: 'u1',
  };
}

describe('Task 9: WBS Tree Builder', () => {
  it('assigns hierarchical WBS numbers and hides children when collapsed', () => {
    const tasks = [
      makeTask('1', null, 'Faz 1'),
      makeTask('2', '1', 'Alt 1'),
      makeTask('3', '1', 'Alt 2'),
      makeTask('4', null, 'Faz 2'),
    ];

    const expanded = buildWbsTree(tasks, new Set());
    expect(expanded.map((r) => [r.wbs, r.depth, r.hasChildren])).toEqual([
      ['1', 0, true],
      ['1.1', 1, false],
      ['1.2', 1, false],
      ['2', 0, false],
    ]);

    const collapsed = buildWbsTree(tasks, new Set(['1']));
    expect(collapsed.map((r) => r.wbs)).toEqual(['1', '2']);
  });
});
