'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';

const TABS = ['all', 'success', 'pending', 'failed'];

export default function DepositPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [deposits, setDeposits] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadDeposits = useCallback(async () => {
    setLoading(true);
    try {
      // getDeposits will accept status, page, limit, search
      const data = await api.getDeposits({ status: activeTab !== 'all' ? activeTab : '', page, limit: 50, search });
      setDeposits(data.deposits);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [activeTab, page, search]);

  useEffect(() => { loadDeposits(); }, [loadDeposits]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadDeposits();
  };

  const columns = [
    { header: 'Waktu', render: (d) => <span className="text-slate-400 break-words">{new Date(d.createdAt).toLocaleString('id-ID')}</span> },
    { header: 'ID Tele', render: (d) => <span className="font-mono text-blue-400 break-words">{d.telegramId}</span> },
    { header: 'User', render: (d) => <span className="font-bold text-slate-200 line-clamp-2">{d.userId?.firstName || '-'}</span> },
    { header: 'Nominal', render: (d) => <span className="font-black text-emerald-400 text-xl break-words">+{d.amount}</span> },
    { header: 'Metode', render: (d) => <span className="font-bold text-slate-300 break-words">{d.paymentMethod}</span> },
    { header: 'Ref ID', render: (d) => <span className="font-mono text-xs text-slate-500 break-all">{d.referenceId}</span> },
    { 
      header: 'Status', 
      render: (d) => (
        <span className={`px-4 py-2 rounded-full text-sm font-black uppercase inline-flex items-center justify-center min-w-[120px] ${
          d.status === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
          d.status === 'failed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_10px_rgba(225,29,72,0.3)]' :
          'bg-amber-500/20 text-amber-500 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
        }`}>
          {d.status === 'success' ? '✅ SUCCESS' : d.status === 'failed' ? '❌ FAILED' : '⏳ PENDING'}
        </span>
      ) 
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">📥 Data Deposit Otomatis</h1>
          <p className="text-slate-400 mt-2 text-base font-medium">Pantau riwayat mutasi Payment Gateway secara global.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Tabs */}
        <div className="bg-slate-800 p-2 rounded-2xl flex flex-wrap gap-2 border border-slate-700 shadow-lg w-full md:w-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-base font-bold capitalize transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700 border border-transparent'
              }`}
            >
              {tab === 'all' ? 'Semua' : tab}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Cari ID Telegram..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-72 bg-slate-800/50 border-2 border-slate-700 rounded-xl px-5 py-4 text-white text-lg font-bold placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
          />
          <button type="submit" className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all flexitems-center">
            🔍 CARI
          </button>
        </form>
      </div>

      <div className="card-dark p-0 overflow-hidden border border-slate-700 shadow-2xl rounded-2xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold text-xl animate-pulse">⚙️ Melakukan sinkronisasi data mutasi...</div>
        ) : (
          <DataTable columns={columns} data={deposits} />
        )}
      </div>

      <div className="flex gap-4 mt-8 justify-center">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-lg">← Mundur</button>
        <span className="text-base font-bold text-slate-400 self-center px-6 bg-slate-800/50 py-3 rounded-xl">Halaman {page}</span>
        <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-lg">Maju →</button>
      </div>
    </div>
  );
}
