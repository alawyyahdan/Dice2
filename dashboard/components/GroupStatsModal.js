'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function GroupStatsModal({ group, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.getGroupStats(group._id);
        setStats(data);
      } catch (err) {
        alert('Gagal meload statistik: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [group]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">📊 Statistik Grup: {group.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-400">Loading statistics...</div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-sm text-slate-400 mb-1">Volume Harian</div>
                <div className="text-2xl font-black text-emerald-400">{(stats.daily || 0).toLocaleString()} pt</div>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-sm text-slate-400 mb-1">Volume Mingguan</div>
                <div className="text-2xl font-black text-blue-400">{(stats.weekly || 0).toLocaleString()} pt</div>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <div className="text-sm text-slate-400 mb-1">Volume Bulanan</div>
                <div className="text-2xl font-black text-purple-400">{(stats.monthly || 0).toLocaleString()} pt</div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-4">🏆 Top 10 Pemain Volume Tertinggi</h3>
            {stats.top10.length === 0 ? (
              <div className="text-center py-6 text-slate-400 bg-slate-800/50 rounded-xl">Belum ada data taruhan di grup ini.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">Rank</th>
                      <th className="px-4 py-3 font-medium">Username</th>
                      <th className="px-4 py-3 font-medium text-right">Volume Keseluruhan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {stats.top10.map((user, i) => (
                      <tr key={user.telegramId} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-slate-400">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                        </td>
                        <td className="px-4 py-3 text-white font-medium">{user.username}</td>
                        <td className="px-4 py-3 text-emerald-400 font-bold text-right">
                          {(user.volume || 0).toLocaleString()} pt
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={onClose} 
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-medium">
                Tutup
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
