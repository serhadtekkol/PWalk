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
  PanelLeftOpen,
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

interface FloatingTip {
  label: string;
  badge?: string;
  top: number;
  left: number;
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
  const [tip, setTip] = useState<FloatingTip | null>(null);

  const showTip = (e: React.MouseEvent<HTMLElement>, label: string, badge?: string) => {
    if (!collapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTip({
      label,
      badge,
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  };

  const hideTip = () => setTip(null);

  return (
    <div className="h-screen flex overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-60'
        } shrink-0 border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 flex flex-col transition-all duration-200 relative`}
      >
        {/* Top Header */}
        <div
          className={`h-14 px-3 flex items-center border-b border-zinc-200 dark:border-zinc-800/80 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 pl-0.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-2xs">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm tracking-tight">PWalk</span>
            </div>
          )}
          <button
            onClick={() => {
              hideTip();
              setCollapsed((c) => !c);
            }}
            onMouseEnter={(e) => showTip(e, 'Kenar çubuğunu aç')}
            onMouseLeave={hideTip}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            aria-label={collapsed ? 'Kenar çubuğunu aç' : 'Kenar çubuğunu daralt'}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-5">
          <div className="space-y-1">
            <button
              onClick={onSelectMyTasks}
              onMouseEnter={(e) => showTip(e, 'Görevlerim')}
              onMouseLeave={hideTip}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
              } py-2 rounded-xl text-sm transition ${
                activeArea === 'my-tasks'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50'
              }`}
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Görevlerim</span>}
            </button>
          </div>

          <div>
            {!collapsed ? (
              <div className="flex items-center justify-between px-2.5 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Projeler</span>
                <button
                  onClick={onOpenCreateProject}
                  className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                  title="Yeni Proje"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex justify-center mb-1.5">
                <button
                  onClick={onOpenCreateProject}
                  onMouseEnter={(e) => showTip(e, 'Yeni Proje Oluştur')}
                  onMouseLeave={hideTip}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-1">
              {projects.map((p) => {
                const active = activeArea === 'project' && selectedProjectId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    onMouseEnter={(e) => showTip(e, p.name, p.key)}
                    onMouseLeave={hideTip}
                    className={`w-full flex items-center ${
                      collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                    } py-2 rounded-xl text-sm transition ${
                      active
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        active && collapsed ? 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-900' : ''
                      }`}
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
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 transition"
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
            onMouseEnter={(e) => showTip(e, 'Bildirimler', unreadCount > 0 ? String(unreadCount) : undefined)}
            onMouseLeave={hideTip}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-0 relative' : 'justify-between px-2.5'
            } py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition`}
          >
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 shrink-0" />
              {!collapsed && <span>Bildirimler</span>}
            </div>
            {unreadCount > 0 && (
              <span
                className={`${
                  collapsed ? 'absolute top-1.5 right-2.5 w-2 h-2 p-0' : 'px-1.5 py-0.5 text-[10px] font-semibold'
                } rounded-full bg-blue-600 text-white`}
              >
                {collapsed ? '' : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={toggleTheme}
            onMouseEnter={(e) => showTip(e, theme === 'dark' ? 'Açık Temaya Geç' : 'Koyu Temaya Geç')}
            onMouseLeave={hideTip}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
            } py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!collapsed && <span>{theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}</span>}
          </button>

          <button
            onClick={onOpenSettings}
            onMouseEnter={(e) => showTip(e, user?.name || 'Profil & Ayarlar', 'Ayarlar')}
            onMouseLeave={hideTip}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
            } py-2 rounded-xl text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{user?.name}</span>}
          </button>

          <button
            onClick={logout}
            onMouseEnter={(e) => showTip(e, 'Çıkış Yap')}
            onMouseLeave={hideTip}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
            } py-2 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      {/* Instant Visual Floating Tooltip when Collapsed */}
      {collapsed && tip && (
        <div
          style={{ top: tip.top, left: tip.left }}
          className="fixed z-50 -translate-y-1/2 pointer-events-none flex items-center animate-toast-in"
        >
          <div className="w-2 h-2 rotate-45 bg-zinc-900 dark:bg-zinc-100 -mr-1 rounded-2xs" />
          <div className="px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium shadow-xl flex items-center gap-2 whitespace-nowrap">
            <span>{tip.label}</span>
            {tip.badge && (
              <span className="px-1.5 py-0.5 rounded-md bg-white/15 dark:bg-zinc-900/15 text-[10px] font-mono">
                {tip.badge}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
