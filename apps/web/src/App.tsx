import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  GanttChart,
  Kanban,
  LayoutDashboard,
  Plus,
  Search,
  Settings2,
} from 'lucide-react';
import { AuthProvider, useAuth } from './stores/auth';
import { ThemeProvider } from './stores/theme';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { MyTasksView } from './components/MyTasksView';
import { NotificationCenter } from './components/NotificationCenter';
import { SettingsModal } from './components/SettingsModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { DashboardView } from './components/DashboardView';
import { KanbanBoard } from './components/KanbanBoard';
import { GanttView } from './components/GanttView';
import { WorkloadView } from './components/WorkloadView';
import { ProjectSettingsView } from './components/ProjectSettingsView';
import { TaskDrawer } from './components/TaskDrawer';
import { apiFetch } from './lib/api';
import type {
  CriticalPathResult,
  NotificationItem,
  Project,
  Task,
  WorkloadReport,
} from './types/pmam';

type ProjectTab = 'overview' | 'kanban' | 'gantt' | 'workload' | 'settings';
const VALID_TABS: ProjectTab[] = ['overview', 'kanban', 'gantt', 'workload', 'settings'];
const NAV_STORAGE_KEY = 'pmam_nav_state';

function readInitialNavState(): {
  projectId: string | null;
  area: 'my-tasks' | 'project';
  tab: ProjectTab;
} {
  try {
    const params = new URLSearchParams(window.location.search);
    const savedRaw = localStorage.getItem(NAV_STORAGE_KEY);
    const saved = savedRaw ? JSON.parse(savedRaw) : {};

    const rawArea = params.get('area') ?? saved.area;
    const area: 'my-tasks' | 'project' = rawArea === 'my-tasks' ? 'my-tasks' : 'project';

    const rawTab = params.get('tab') ?? saved.tab;
    const tab: ProjectTab = VALID_TABS.includes(rawTab as ProjectTab) ? (rawTab as ProjectTab) : 'kanban';

    const projectId = params.get('project') ?? saved.projectId ?? null;
    return { projectId, area, tab };
  } catch {
    return { projectId: null, area: 'project', tab: 'kanban' };
  }
}

function AuthenticatedWorkspace() {
  const { user } = useAuth();
  const initialNav = useMemo(() => readInitialNavState(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialNav.projectId);
  const [activeArea, setActiveArea] = useState<'my-tasks' | 'project'>(initialNav.area);
  const [projectTab, setProjectTab] = useState<ProjectTab>(initialNav.tab);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [criticalPath, setCriticalPath] = useState<CriticalPathResult | null>(null);
  const [workload, setWorkload] = useState<WorkloadReport | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createProjOpen, setCreateProjOpen] = useState(false);

  const loadBootstrap = useCallback(async () => {
    const [projs, mine, notifs] = await Promise.all([
      apiFetch<Project[]>('/api/v1/projects'),
      apiFetch<Task[]>('/api/v1/tasks/my'),
      apiFetch<NotificationItem[]>('/api/v1/notifications'),
    ]);
    setProjects(projs);
    setMyTasks(mine);
    setNotifications(notifs);
    if (projs.length > 0 && (!selectedProjectId || !projs.some((p) => p.id === selectedProjectId))) {
      setSelectedProjectId(projs[0].id);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        NAV_STORAGE_KEY,
        JSON.stringify({ projectId: selectedProjectId, area: activeArea, tab: projectTab }),
      );
      const params = new URLSearchParams(window.location.search);
      params.set('area', activeArea);
      params.set('tab', projectTab);
      if (selectedProjectId) params.set('project', selectedProjectId);
      else params.delete('project');
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', nextUrl);
    } catch {
      // ignore storage errors
    }
  }, [selectedProjectId, activeArea, projectTab]);

  const loadProjectData = useCallback(async (projectId: string) => {
    const [projectDetail, projTasks, cpm, wl] = await Promise.all([
      apiFetch<Project>(`/api/v1/projects/${projectId}`),
      apiFetch<Task[]>(`/api/v1/projects/${projectId}/tasks`),
      apiFetch<CriticalPathResult>(`/api/v1/projects/${projectId}/schedule/critical-path`),
      apiFetch<WorkloadReport>(`/api/v1/projects/${projectId}/workload`),
    ]);
    setProjects((prev) => prev.map((p) => (p.id === projectId ? projectDetail : p)));
    setTasks(projTasks);
    setCriticalPath(cpm);
    setWorkload(wl);
  }, []);

  useEffect(() => {
    loadBootstrap().catch(() => {});
  }, [loadBootstrap]);

  useEffect(() => {
    if (activeArea === 'project' && selectedProjectId) {
      loadProjectData(selectedProjectId).catch(() => {});
    }
  }, [activeArea, selectedProjectId, loadProjectData]);

  const activeProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.code.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (filterAssignee && t.assigneeId !== filterAssignee) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      return true;
    });
  }, [tasks, search, filterAssignee, filterPriority]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleQuickCreate = async (columnId: string, title: string) => {
    if (!activeProject) return;
    const now = new Date();
    const due = new Date(now.getTime() + 3 * 86_400_000);
    await apiFetch(`/api/v1/projects/${activeProject.id}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        columnId,
        startDate: now.toISOString(),
        dueDate: due.toISOString(),
      }),
    });
    await loadProjectData(activeProject.id);
  };

  const handleNewTaskClick = async () => {
    if (!activeProject) return;
    const firstCol = [...activeProject.columns].sort((a, b) => a.order - b.order)[0];
    if (!firstCol) return;
    const now = new Date();
    const due = new Date(now.getTime() + 3 * 86_400_000);
    const created = await apiFetch<Task>(`/api/v1/projects/${activeProject.id}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'Yeni Görev',
        columnId: firstCol.id,
        startDate: now.toISOString(),
        dueDate: due.toISOString(),
      }),
    });
    await loadProjectData(activeProject.id);
    setSelectedTaskId(created.id);
  };

  return (
    <>
      <AppShell
        projects={projects}
        selectedProjectId={selectedProjectId}
        activeArea={activeArea}
        unreadCount={unreadCount}
        onSelectMyTasks={() => setActiveArea('my-tasks')}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          setActiveArea('project');
        }}
        onOpenCreateProject={() => setCreateProjOpen(true)}
        onOpenNotifications={() => setNotifOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      >
        {activeArea === 'my-tasks' || !activeProject ? (
          <MyTasksView
            tasks={myTasks}
            onSelectTask={(t) => {
              setSelectedProjectId(t.projectId);
              setActiveArea('project');
              setSelectedTaskId(t.id);
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Project Top Header */}
            <header className="h-14 px-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: activeProject.color }}
                />
                <h1 className="text-sm font-semibold truncate">{activeProject.name}</h1>
                <span className="text-xs font-mono text-zinc-400">{activeProject.key}</span>

                <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

                {/* View Tabs */}
                <nav className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setProjectTab('overview')}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      projectTab === 'overview'
                        ? 'bg-zinc-100 dark:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" /> Özet
                  </button>
                  <button
                    onClick={() => setProjectTab('kanban')}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      projectTab === 'kanban'
                        ? 'bg-zinc-100 dark:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Kanban className="w-3.5 h-3.5" /> Kanban
                  </button>
                  <button
                    onClick={() => setProjectTab('gantt')}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      projectTab === 'gantt'
                        ? 'bg-zinc-100 dark:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <GanttChart className="w-3.5 h-3.5" /> Gantt &amp; WBS
                  </button>
                  <button
                    onClick={() => setProjectTab('workload')}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      projectTab === 'workload'
                        ? 'bg-zinc-100 dark:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> İş Yükü
                  </button>
                  <button
                    onClick={() => setProjectTab('settings')}
                    className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      projectTab === 'settings'
                        ? 'bg-zinc-100 dark:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Settings2 className="w-3.5 h-3.5" /> Ayarlar
                  </button>
                </nav>
              </div>

              {/* Filters & New Task */}
              <div className="flex items-center gap-2">
                <div className="relative hidden md:block">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Görev ara..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent w-40 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="hidden lg:block px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                >
                  <option value="">Tüm Üyeler</option>
                  {activeProject.members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="hidden lg:block px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                >
                  <option value="">Tüm Öncelikler</option>
                  <option value="URGENT">Acil</option>
                  <option value="HIGH">Yüksek</option>
                  <option value="MEDIUM">Orta</option>
                  <option value="LOW">Düşük</option>
                </select>

                <button
                  onClick={handleNewTaskClick}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium flex items-center gap-1 hover:opacity-90"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Yeni Görev
                </button>
              </div>
            </header>

            {projectTab === 'overview' && (
              <DashboardView
                project={activeProject}
                tasks={filteredTasks}
                criticalPath={criticalPath}
                workload={workload}
                onSelectTask={(t) => setSelectedTaskId(t.id)}
              />
            )}

            {projectTab === 'kanban' && (
              <KanbanBoard
                columns={activeProject.columns}
                tasks={filteredTasks}
                criticalPath={criticalPath}
                currentUserId={user?.id}
                onSelectTask={(t) => setSelectedTaskId(t.id)}
                onQuickCreate={handleQuickCreate}
                onMoveTask={async (taskId, columnId, order) => {
                  await apiFetch(`/api/v1/tasks/${taskId}/move`, {
                    method: 'POST',
                    body: JSON.stringify({ columnId, order }),
                  });
                  await loadProjectData(activeProject.id);
                }}
                onAddColumn={async (payload) => {
                  await apiFetch(`/api/v1/projects/${activeProject.id}/columns`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  });
                  await loadProjectData(activeProject.id);
                }}
                onUpdateColumn={async (columnId, payload) => {
                  await apiFetch(`/api/v1/columns/${columnId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                  });
                  await loadProjectData(activeProject.id);
                }}
                onDeleteColumn={async (columnId) => {
                  await apiFetch(`/api/v1/columns/${columnId}`, {
                    method: 'DELETE',
                  });
                  await loadProjectData(activeProject.id);
                }}
                onMoveColumn={async (columnId, dir) => {
                  const sorted = [...activeProject.columns].sort((a, b) => a.order - b.order);
                  const idx = sorted.findIndex((c) => c.id === columnId);
                  const targetIdx = idx + dir;
                  if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length) return;
                  const ids = sorted.map((c) => c.id);
                  [ids[idx], ids[targetIdx]] = [ids[targetIdx], ids[idx]];
                  await apiFetch(`/api/v1/projects/${activeProject.id}/columns/reorder`, {
                    method: 'POST',
                    body: JSON.stringify({ columnIds: ids }),
                  });
                  await loadProjectData(activeProject.id);
                }}
              />
            )}

            {projectTab === 'gantt' && (
              <GanttView
                tasks={filteredTasks}
                criticalPath={criticalPath}
                onSelectTask={(t) => setSelectedTaskId(t.id)}
                onUpdateDates={async (taskId, startDate, dueDate, cascade) => {
                  await apiFetch(`/api/v1/tasks/${taskId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ startDate, dueDate, cascade }),
                  });
                  await loadProjectData(activeProject.id);
                }}
                onTakeBaseline={async () => {
                  await apiFetch(`/api/v1/projects/${activeProject.id}/schedule/baseline`, {
                    method: 'POST',
                  });
                  await loadProjectData(activeProject.id);
                }}
                onExportCsv={async () => {
                  const token = localStorage.getItem('pmam_access_token');
                  const res = await fetch(`/api/v1/projects/${activeProject.id}/export/csv`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  });
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${activeProject.key.toLowerCase()}-tasks.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                onExportIcs={async () => {
                  const token = localStorage.getItem('pmam_access_token');
                  const res = await fetch(`/api/v1/projects/${activeProject.id}/export/ics`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  });
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${activeProject.key.toLowerCase()}-schedule.ics`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              />
            )}

            {projectTab === 'workload' && <WorkloadView report={workload} />}

            {projectTab === 'settings' && (
              <ProjectSettingsView
                project={activeProject}
                onUpdated={() => loadProjectData(activeProject.id)}
              />
            )}
          </div>
        )}
      </AppShell>

      <TaskDrawer
        task={selectedTask}
        allTasks={tasks}
        columns={activeProject?.columns ?? []}
        members={activeProject?.members ?? []}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={async () => {
          if (activeProject) await loadProjectData(activeProject.id);
        }}
        onDeleted={async () => {
          if (activeProject) await loadProjectData(activeProject.id);
        }}
        onCreateSubtask={async (parentId, title) => {
          if (!activeProject) return;
          const now = new Date();
          const due = new Date(now.getTime() + 2 * 86_400_000);
          await apiFetch(`/api/v1/projects/${activeProject.id}/tasks`, {
            method: 'POST',
            body: JSON.stringify({
              title,
              parentId,
              startDate: now.toISOString(),
              dueDate: due.toISOString(),
            }),
          });
          await loadProjectData(activeProject.id);
        }}
        onSelectTask={(t) => setSelectedTaskId(t.id)}
      />

      <NotificationCenter
        open={notifOpen}
        notifications={notifications}
        onClose={() => setNotifOpen(false)}
        onMarkRead={async (id) => {
          await apiFetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
          setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        }}
        onMarkAllRead={async () => {
          await apiFetch('/api/v1/notifications/read-all', { method: 'POST' });
          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        }}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <CreateProjectModal
        open={createProjOpen}
        onClose={() => setCreateProjOpen(false)}
        onCreated={(p) => {
          setProjects((prev) => [p, ...prev]);
          setSelectedProjectId(p.id);
          setActiveArea('project');
        }}
      />
    </>
  );
}

function RootRouter() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">Yükleniyor...</div>
    );
  }
  return user ? <AuthenticatedWorkspace /> : <LoginPage />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}
