import React from 'react';
import type { WorkloadReport } from '../types/pmam';

export function WorkloadView({ report }: { report: WorkloadReport | null }) {
  if (!report) {
    return <div className="p-6 text-sm text-zinc-500">İş yükü verileri yükleniyor...</div>;
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Ekip İş Yükü &amp; Kapasite Takibi</h3>
        <p className="text-xs text-zinc-500">
          Günlük tahmini efor saatleri üyenin günlük çalışma kapasitesini aşarsa kırmızı ile vurgulanır.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <th className="text-left px-4 py-3 font-semibold min-w-[200px] sticky left-0 bg-zinc-50 dark:bg-zinc-900">
                Üye (Kapasite)
              </th>
              {report.days.map((d) => (
                <th key={d} className="px-2 py-3 font-medium text-zinc-500 text-center min-w-[64px]">
                  {new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {report.members.map((m) => (
              <tr key={m.userId}>
                <td className="px-4 py-3 font-medium sticky left-0 bg-white dark:bg-zinc-900 flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full text-[10px] font-semibold text-white flex items-center justify-center shrink-0"
                    style={{ backgroundColor: m.avatarColor }}
                  >
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div>{m.name}</div>
                    <div className="text-[10px] text-zinc-400">{m.dailyCapacityHours} sa/gün</div>
                  </div>
                </td>
                {m.days.map((day) => {
                  const bg =
                    day.allocatedHours === 0
                      ? 'text-zinc-300 dark:text-zinc-700'
                      : day.overloaded
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 font-semibold'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium';
                  return (
                    <td key={day.date} className={`px-2 py-3 text-center font-mono ${bg}`}>
                      {day.allocatedHours > 0 ? `${day.allocatedHours}s` : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
