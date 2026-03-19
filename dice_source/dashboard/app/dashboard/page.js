'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StatsCard from '@/components/StatsCard';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [chartLabels, setChartLabels] = useState([]);

  const maxVol = chartData.length > 0 ? Math.max(...chartData, 100) : 100;

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [usersData, betsData, pendingWd, vol7d] = await Promise.all([
        api.getUsers({ limit: 1 }),
        api.getBets({ limit: 1 }),
        api.getWithdraws({ status: 'pending', limit: 1 }),
        api.getVolume7d()
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayBets = await api.getBets({ dateFrom: today.toISOString(), limit: 1000 });

      setStats({
        totalUsers: usersData.total,
        totalBets: betsData.total,
        todayBets: todayBets.total,
        todayVolume: todayBets.stats?.totalBet || 0,
        pendingWd: pendingWd.total,
      });

      setChartData(vol7d.chartData);
      setChartLabels(vol7d.labels);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) return <div className="text-center py-20 text-slate-500 font-bold text-2xl animate-pulse">Memuat data...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">System Overview</h1>
          <p className="text-slate-400 mt-2 text-lg font-medium">Ringkasan statistik real-time jaringan DiceBot.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatsCard icon="👥" title="Total User" value={stats?.totalUsers || 0} color="blue" />
        <StatsCard icon="🎲" title="Taruh Hari Ini" value={stats?.todayBets || 0} color="purple" />
        <StatsCard icon="💰" title="Vol Hari Ini" value={(stats?.todayVolume || 0).toLocaleString()} color="green" />
        <StatsCard icon="💸" title="WD Pending" value={stats?.pendingWd || 0} color="yellow" sub="Cek Antrean" />
        <StatsCard icon="📈" title="Bet All Time" value={stats?.totalBets || 0} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-dark p-8 lg:col-span-2">
          <h2 className="text-2xl font-black text-white mb-8">📈 Volume 7 Hari Terakhir</h2>
          <div className="h-64 flex items-end justify-between gap-4 border-b-2 border-slate-700 pb-2">
            {chartData.map((val, i) => (
              <div key={i} className="h-full flex flex-col justify-end items-center gap-2 flex-1 group">
                <div 
                  className="w-full bg-blue-500/20 group-hover:bg-blue-500 border-t border-blue-500/50 group-hover:border-transparent transition-all rounded-t-lg relative"
                  style={{ height: `${maxVol === 0 ? 0 : Math.max((val / maxVol) * 100, 1)}%` }}
                >
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-sm font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-900 border border-slate-700 rounded-lg py-1 px-3 shadow-xl z-10 pointer-events-none">
                    {val.toLocaleString()} pt
                  </span>
                </div>
                <span className="text-base font-bold text-slate-500 group-hover:text-slate-300 transition-colors uppercase h-6 flex items-end">{chartLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-dark p-8">
          <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
            <span className="text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">⚡</span> Akses Cepat
          </h2>
          <div className="flex flex-col gap-5">
            {[
              { href: '/dashboard/withdraw', label: '💸 Kelola Withdraw', color: 'bg-slate-700 text-slate-200 hover:bg-slate-600 border-slate-600' },
              { href: '/dashboard/users', label: '👥 Data Users', color: 'bg-slate-700 text-slate-200 hover:bg-slate-600 border-slate-600' },
              { href: '/dashboard/bets', label: '🎲 History Taruhan', color: 'bg-slate-700 text-slate-200 hover:bg-slate-600 border-slate-600' },
              { href: '/dashboard/balance', label: '💰 Adjust Saldo', color: 'bg-slate-700 text-slate-200 hover:bg-slate-600 border-slate-600' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`${item.color} border px-6 py-5 rounded-2xl text-lg font-bold transition-all shadow-lg flex items-center justify-between group`}
              >
                {item.label}
                <span className="opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-2 inline-block font-black text-2xl leading-none">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
