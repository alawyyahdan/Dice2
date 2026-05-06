'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import StatsCard from '@/components/StatsCard';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const res = await api.getAnalytics();
      setData(res);
    } catch (e) {
      console.error(e);
      alert('Gagal memuat data Analytics: ' + e.message);
    }
    setLoading(false);
  }

  if (loading) return <div className="text-center py-20 text-slate-500 font-bold text-2xl animate-pulse">Memuat Analytics...</div>;

  const maxAxis = data?.dailyVolume?.length > 0
    ? Math.max(...data.dailyVolume.map(d => Math.max(d.deposit, d.withdraw)), 100)
    : 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">📈 Server Analytics & PnL</h1>
          <p className="text-slate-400 mt-2 text-lg font-medium">Laporan Pemasukan, Pengeluaran, dan Profit system secara keseluruhan.</p>
        </div>
        <button onClick={() => { setLoading(true); loadAnalytics(); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 w-fit">
          <span>🔄</span> Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard icon="📥" title="Total Deposit (Masuk)" value={`Rp ${data?.totalDeposit?.toLocaleString() || 0}`} color="green" />
        <StatsCard icon="💸" title="Total Withdraw (Keluar)" value={`Rp ${data?.totalWithdraw?.toLocaleString() || 0}`} color="red" />
        <StatsCard icon="💎" title="PROFIT BERSIH (P&L)" value={`Rp ${data?.pnl?.toLocaleString() || 0}`} color={data?.pnl >= 0 ? "blue" : "red"} />
        <StatsCard icon="🏦" title="Saldo Provider PG Live" value={`Rp ${data?.pgBalance?.toLocaleString() || 0}`} color="yellow" sub="Real-time SiTranfer" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="card-dark p-8">
          <h2 className="text-2xl font-black text-white mb-2">📊 Daily Volume (Deposit vs Withdraw)</h2>
          <p className="text-slate-400 text-sm mb-8">Perbandingan nominal yang berhasil disetujui setiap harinya.</p>
          
          <div className="h-[340px] pt-20 flex items-end justify-between gap-2 border-b-2 border-slate-700 pb-2 overflow-x-auto relative scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {data?.dailyVolume?.length === 0 && (
               <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-bold">Belum ada transaksi berhasil.</div>
            )}
            {data?.dailyVolume?.map((day, i) => (
              <div key={i} className="h-full flex flex-col justify-end items-center gap-1 min-w-[60px] flex-1 group relative">
                
                {/* Tooltip */}
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-800 border-2 border-slate-700 rounded-lg p-2 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap hidden group-hover:flex flex-col gap-1 items-center">
                   <div className="text-xs font-bold text-white border-b border-slate-600 pb-1 w-full text-center">{day.date}</div>
                   <div className="text-xs font-bold text-emerald-400">In: Rp {day.deposit.toLocaleString()}</div>
                   <div className="text-xs font-bold text-rose-400">Out: Rp {day.withdraw.toLocaleString()}</div>
                </div>

                <div className="w-full flex justify-center items-end gap-1 h-full">
                  {/* Deposit Bar */}
                  <div 
                    className="w-full max-w-[20px] bg-emerald-500/30 hover:bg-emerald-500 border-t-2 border-emerald-500 rounded-t-sm transition-all"
                    style={{ height: `${maxAxis === 0 ? 0 : Math.max((day.deposit / maxAxis) * 100, 2)}%` }}
                  />
                  {/* Withdraw Bar */}
                  <div 
                    className="w-full max-w-[20px] bg-rose-500/30 hover:bg-rose-500 border-t-2 border-rose-500 rounded-t-sm transition-all"
                    style={{ height: `${maxAxis === 0 ? 0 : Math.max((day.withdraw / maxAxis) * 100, 2)}%` }}
                  />
                </div>
                {/* Date Label (Short format MM-DD) */}
                <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300 transition-colors uppercase h-6 flex items-end">
                   {day.date.split('-').slice(1).join('/')}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 mt-6 pt-4">
             <div className="flex items-center gap-2">
               <div className="w-4 h-4 rounded bg-emerald-500/50 border border-emerald-500"></div>
               <span className="text-sm font-bold text-slate-400">Deposit Masuk</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-4 h-4 rounded bg-rose-500/50 border border-rose-500"></div>
               <span className="text-sm font-bold text-slate-400">Withdraw Keluar</span>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
