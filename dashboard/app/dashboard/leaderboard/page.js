'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function LeaderboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('daily');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [filter]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const json = await api.getLeaderboardAdmin(filter);
      setData(json.leaderboard || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatIDR = (pts) => `Rp ${(pts * 1000).toLocaleString('id-ID')}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">🏆 Global Leaderboard</h1>
          <p className="text-slate-400 mt-2 font-medium">Pantau aktivitas volume taruhan, total P&L, dan deposit para Whale.</p>
        </div>
        <div className="flex gap-2 p-1 bg-slate-800 rounded-lg border border-slate-700">
          <button onClick={() => setFilter('daily')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${filter === 'daily' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>Harian</button>
          <button onClick={() => setFilter('weekly')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${filter === 'weekly' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>Mingguan</button>
          <button onClick={() => setFilter('monthly')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${filter === 'monthly' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>Bulanan</button>
          <button onClick={() => setFilter('all_time')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${filter === 'all_time' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>Sepanjang Masa</button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-900/50 border border-red-500 text-red-100 rounded-xl">⚠️ {error}</div>}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase bg-slate-900/50 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-black tracking-wider">Rank</th>
                <th className="px-6 py-4 font-black tracking-wider">User</th>
                <th className="px-6 py-4 font-black tracking-wider">Trading Volume (Points)</th>
                <th className="px-6 py-4 font-black tracking-wider text-green-400">Total Win</th>
                <th className="px-6 py-4 font-black tracking-wider text-red-400">Total Lose</th>
                <th className="px-6 py-4 font-black tracking-wider text-blue-400">Platform P&L</th>
                <th className="px-6 py-4 font-black tracking-wider text-amber-400">Total Deposit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-medium animate-pulse">Memuat data super komputer...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-medium">Tidak ada aktivitas pada periode ini.</td></tr>
              ) : data.map((row, i) => {
                const isWhale = row.volume > 10000;
                const platformProfit = row.lose - row.win;
                return (
                  <tr key={row.telegramId} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-500">#{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white tracking-wide">{row.username} {isWhale && '🐋'}</div>
                      <div className="text-xs text-slate-500">{row.telegramId}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">🔥 {row.volume.toLocaleString('id-ID')} pt</td>
                    <td className="px-6 py-4 font-medium text-green-400">+{row.win.toLocaleString('id-ID')} pt</td>
                    <td className="px-6 py-4 font-medium text-red-400">-{row.lose.toLocaleString('id-ID')} pt</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md font-bold text-xs ${platformProfit >= 0 ? 'bg-green-900/40 text-green-400 border border-green-800' : 'bg-red-900/40 text-red-400 border border-red-800'}`}>
                        {platformProfit >= 0 ? '+' : ''}{platformProfit.toLocaleString('id-ID')} pt
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-amber-400">{formatIDR(row.deposit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
