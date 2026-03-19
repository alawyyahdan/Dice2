'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import WithdrawCard from '@/components/WithdrawCard';

const TABS = ['pending', 'approved', 'rejected'];

export default function WithdrawPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [withdraws, setWithdraws] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadWithdraws = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getWithdraws({ status: activeTab, page, limit: 20 });
      setWithdraws(data.requests);
      setTotal(data.total);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [activeTab, page]);

  useEffect(() => { loadWithdraws(); }, [loadWithdraws]);

  // Auto-refresh pending setiap 30 detik
  useEffect(() => {
    if (activeTab !== 'pending') return;
    const interval = setInterval(loadWithdraws, 30000);
    return () => clearInterval(interval);
  }, [activeTab, loadWithdraws]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">💸 Pengajuan Withdraw</h1>
          <p className="text-slate-400 mt-2 text-base font-medium">Tinjau, setujui, lalu kirim dana ke rekening pemain.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-800 p-2 rounded-2xl inline-flex flex-wrap gap-2 items-center border border-slate-700 shadow-lg">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); }}
            className={`px-6 py-3 rounded-xl text-base font-bold capitalize transition-all duration-200 flex items-center gap-3 ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-700 border border-transparent'
            }`}
          >
            <span className="text-lg">{tab === 'pending' ? '⏳' : tab === 'approved' ? '✅' : '❌'}</span>
            {tab}
            <span className={`text-xs px-2.5 py-1 rounded-full border ml-1 font-mono ${activeTab === tab ? 'bg-black/20 border-transparent' : 'border-slate-600'}`}>
              {activeTab === tab ? total : '•'}
            </span>
          </button>
        ))}
        {activeTab === 'pending' && (
          <span className="text-xs font-bold px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full ml-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live (30s)
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-24 text-slate-400 font-bold text-2xl animate-pulse">⚙️ Memuat riwayat penarikan...</div>
      ) : withdraws.length === 0 ? (
        <div className="card-dark text-center py-24 text-slate-400 font-bold text-xl uppercase tracking-wider">TIDAK ADA REQUEST {activeTab}.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {withdraws.map((wd) => (
            <WithdrawCard key={wd._id} wd={wd} onUpdate={loadWithdraws} />
          ))}
        </div>
      )}

      <div className="flex gap-4 mt-8 justify-center">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-lg">← Mundur</button>
        <span className="text-base font-bold text-slate-400 self-center px-6 bg-slate-800/50 py-3 rounded-xl">Halaman {page}</span>
        <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-lg">Maju →</button>
      </div>
    </div>
  );
}
