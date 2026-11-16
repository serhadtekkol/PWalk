import React, { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './stores/auth';
import { ThemeProvider } from './stores/theme';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/AppShell';
import { MyTasksView } from './components/MyTasksView';
import { NotificationCenter } from './components/NotificationCenter';
import { SettingsModal } from './components/SettingsModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { apiFetch } from './lib/api';
import type { NotificationItem, Project, Task } from './types/pmam';

function AuthenticatedWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<'my-tasks' | 'project'>('project');
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
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
    if (projs.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projs[0].id);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadBootstrap().catch(() => {});
  }, [loadBootstrap]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const activeProject = projects.find((p) => p.id === selectedProjectId) ?? null;

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
            }}
          />
        ) : (
          <div className="p-6 text-sm text-zinc-500">Proje görünümü yükleniyor: {activeProject.name}</div>
        )}
      </AppShell>

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
