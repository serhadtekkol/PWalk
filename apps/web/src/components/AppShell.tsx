import React, { useState } from 'react';
import {
  Bell,
  CheckSquare,
  FolderKanban,
  Layers,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import type { Project } from '../types/pmam';
import { useAuth } from '../stores/auth';
import { useTheme } from '../stores/theme';

interface AppShellProps {
  projects: Project[];
  selectedProjectId: string | null;
  activeArea: 'my-tasks' | 'project';
  unreadCount: number;
  onSelectMyTasks: () => void;
  onSelectProject: (id: string) => void;
  onOpenCreateProject: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  children: React.ReactNode;
}

export function AppShell({
  projects,
  selectedProjectId,
  activeArea,
  unreadCount,
  onSelectMyTasks,
  onSelectProject,
  onOpenCreateProject,
  onOpenNotifications,
  onOpenSettings,
  children,
}: AppShellProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-60'
        } shrink-0 border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 flex flex-col transition-all duration-200`}
      >
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm tracking-tight">PWalk</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition mx-auto"
            title={collapsed ? 'Kenar çubuğunu aç' : 'Kenar çubuğunu daralt'}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-5">
          <div className="space-y-1">
            <button
              onClick={onSelectMyTasks}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition ${
                activeArea === 'my-tasks'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50'
              }`}
              title="Görevlerim"
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Görevlerim</span>}
            </button>
          </div>

          <div>
            {!collapsed && (
              <div className="flex items-center justify-between px-2.5 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Projeler</span>
                <button
                  onClick={onOpenCreateProject}
                  className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                  title="Yeni Proje"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="space-y-0.5">
              {projects.map((p) => {
                const active = activeArea === 'project' && selectedProjectId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition ${
                      active
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50'
                    }`}
                    title={p.name}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color || '#2563eb' }}
                    />
                    {!collapsed && (
                      <>
                        <span className="truncate flex-1 text-left">{p.name}</span>
                        <span className="text-[10px] font-mono text-zinc-400">{p.key}</span>
                      </>
                    )}
                  </button>
                );
              })}
              {projects.length === 0 && !collapsed && (
                <button
                  onClick={onOpenCreateProject}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 transition"
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  İlk Projeyi Oluştur
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="p-2.5 border-t border-zinc-200 dark:border-zinc-800/80 space-y-1">
          <button
            onClick={onOpenNotifications}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition"
            title="Bildirimler"
          >
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Bildirimler</span>}
            </div>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-600 text-white">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition"
            title="Tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!collapsed && <span>{theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}</span>}
          </button>

          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition"
            title="Profil & Bildirim Ayarları"
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{user?.name}</span>}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            title="Çıkış Yap"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
