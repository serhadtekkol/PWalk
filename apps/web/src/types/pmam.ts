export type SystemRole = 'ADMIN' | 'MEMBER';
export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  role: SystemRole;
  dailyCapacityHours: number;
  ntfyTopic: string | null;
  createdAt: string;
}

export interface BoardColumn {
  id: string;
  projectId: string;
  name: string;
  order: number;
  wipLimit: number | null;
  mappedStatus: TaskStatus;
  color: string | null;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarColor'> & { dailyCapacityHours?: number };
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  color: string;
  status: 'ACTIVE' | 'ARCHIVED';
  taskSeq: number;
  columns: BoardColumn[];
  members: ProjectMember[];
}

export interface TaskDependency {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface Task {
  id: string;
  projectId: string;
  code: string;
  parentId: string | null;
  columnId: string;
  order: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: string;
  dueDate: string;
  estimatedHours: number;
  progress: number;
  isMilestone: boolean;
  assigneeId: string | null;
  creatorId: string;
  assignee?: Pick<User, 'id' | 'name' | 'email' | 'avatarColor'> | null;
  creator?: Pick<User, 'id' | 'name' | 'email' | 'avatarColor'>;
  project?: Project;
  predecessorLinks?: TaskDependency[];
  successorLinks?: TaskDependency[];
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatarColor'>;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  metadata: string | null;
  createdAt: string;
  user: Pick<User, 'id' | 'name' | 'avatarColor'>;
}

export interface Reminder {
  id: string;
  taskId: string;
  userId: string;
  remindAt: string;
  message: string | null;
  sentAt: string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  taskId: string | null;
  type: 'ASSIGNED' | 'REMINDER' | 'DUE_SOON' | 'OVERDUE' | 'COMMENT';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface CriticalPathResult {
  projectDurationDays: number;
  criticalTaskIds: string[];
  nodes: Record<
    string,
    {
      durationDays: number;
      earlyStart: number;
      earlyFinish: number;
      lateStart: number;
      lateFinish: number;
      slackDays: number;
      isCritical: boolean;
    }
  >;
}

export interface WorkloadReport {
  days: string[];
  members: {
    userId: string;
    name: string;
    avatarColor: string;
    dailyCapacityHours: number;
    days: {
      date: string;
      allocatedHours: number;
      overloaded: boolean;
    }[];
  }[];
}
