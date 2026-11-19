import React, { useState } from 'react';
import { Layers, ArrowRight, Sun, Moon } from 'lucide-react';
import { useAuth } from '../stores/auth';
import { useTheme } from '../stores/theme';

export function LoginPage() {
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err: any) {
      setError(err.message || 'Bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950 relative">
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        title="Tema Değiştir"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">PWalk</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Kanban &amp; MS Project Planlama</p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-6 shadow-sm">
          <div className="flex gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 mb-5 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-1.5 rounded-md transition ${
                mode === 'login'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 py-1.5 rounded-md transition ${
                mode === 'register'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Kayıt Ol
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Ad Soyad</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Serhad Bahadır"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">E-posta</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ad@sirket.com"
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Şifre</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition"
            >
              {submitting ? 'İşleniyor...' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
