'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';

const TABS = ['all', 'success', 'pending', 'failed'];

export default function DepositPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [deposits, setDeposits] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalSuccess: 0, totalPending: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDeposits({ status: activeTab !== 'all' ? activeTab : '', page, limit: 50, search, dateFrom, dateTo });
      setDeposits(data.deposits);
      setTotal(data.total);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [activeTab, page, search, dateFrom, dateTo]);

  useEffect(() => { loadDeposits(); }, [loadDeposits]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadDeposits();
  };

  const handleAction = async (id, action) => {
    if (!confirm(`Apakah Anda yakin ingin menandai deposit ini sebagai ${action.toUpperCase()}?`)) return;
    try {
      await api.depositAction(id, action);
      loadDeposits();
    } catch (e) {
      alert('❌ Gagal: ' + (e.response?.data?.error || e.message));
    }
  };

  const [resyncing, setResyncing] = useState(false);

  const handleResync = async () => {
    if (resyncing) return;
    setResyncing(true);
    try {
      const d = await api.depositResync();
      alert(d.message || 'Selesai');
      loadDeposits();
    } catch(e) {
      alert('Gagal RESYNC: ' + e.message);
    } finally {
      setResyncing(false);
    }
  };

  const columns = [
    { key: 'createdAt', label: 'Waktu', render: (_, d) => <span className="text-slate-400 break-words">{new Date(d.createdAt).toLocaleString('id-ID')}</span> },
    { key: 'telegramId', label: 'ID Tele', render: (_, d) => <span className="font-mono text-blue-400 break-words">{d.telegramId}</span> },
    { key: 'userId', label: 'User', render: (_, d) => <span className="font-bold text-slate-200 line-clamp-2">{d.userId?.firstName || '-'}</span> },
    { key: 'amount', label: 'Nominal', render: (_, d) => <span className="font-black text-emerald-400 text-xl break-words">+{d.amount}</span> },
    { key: 'paymentMethod', label: 'Metode', render: (_, d) => <span className="font-bold text-slate-300 break-words">{d.paymentMethod}</span> },
    { key: 'referenceId', label: 'Ref ID', render: (_, d) => <span className="font-mono text-xs text-slate-500 break-all">{d.referenceId}</span> },
    { 
      key: 'status',
      label: 'Status', 
      render: (_, d) => (
        <span className={`px-4 py-2 rounded-full text-sm font-black uppercase inline-flex items-center justify-center min-w-[120px] ${
          d.status === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
          d.status === 'failed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_10px_rgba(225,29,72,0.3)]' :
          'bg-amber-500/20 text-amber-500 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
        }`}>
          {d.status === 'success' ? '✅ SUCCESS' : d.status === 'failed' ? '❌ FAILED' : '⏳ PENDING'}
        </span>
      ) 
    },
    {
      key: 'aksi',
      label: 'Aksi',
      render: (_, d) => d.status === 'pending' ? (
        <div className="flex gap-2">
          <button onClick={() => handleAction(d._id, 'success')} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg transition-colors">Terima</button>
          <button onClick={() => handleAction(d._id, 'failed')} className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-lg transition-colors">Batal</button>
        </div>
      ) : <span className="text-slate-500 font-bold text-sm">-</span>
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">📥 Data Deposit Otomatis</h1>
          <p className="text-slate-400 mt-2 text-base font-medium">Pantau riwayat mutasi Payment Gateway secara global.</p>
        </div>

        <div className="flex gap-4 items-start">
          {/* RESYNC Button */}
          <button
            onClick={handleResync}
            disabled={resyncing}
            className={`px-5 py-4 rounded-2xl font-black text-sm flex items-center gap-2 border transition-all shadow-xl ${
              resyncing
                ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed'
                : 'bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600 hover:text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
            }`}
          >
            <svg className={resyncing ? 'animate-spin' : ''} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 12c0-4.4 3.6-8 8-8 3 0 5.6 1.7 7 4.2M22 12c0 4.4-3.6 8-8 8-3 0-5.6-1.7-7-4.2"/></svg>
            {resyncing ? 'RESYNCING...' : 'RESYNC'}
          </button>

          {/* Stats */}
          <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest relative z-10">Total Success</p>
            <p className="text-3xl font-black text-emerald-400 mt-2 relative z-10">{stats.totalSuccess.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest relative z-10">Total Pending</p>
            <p className="text-3xl font-black text-amber-400 mt-2 relative z-10">{stats.totalPending.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
        {/* Tabs */}
        <div className="bg-slate-800 p-2 rounded-2xl flex flex-wrap gap-2 border border-slate-700 shadow-lg w-full xl:w-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`flex-1 xl:flex-none px-6 py-3 rounded-xl text-base font-bold capitalize transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700 border border-transparent'
              }`}
            >
              {tab === 'all' ? 'Semua' : tab}
            </button>
          ))}
        </div>

        {/* Filters */}
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 w-full xl:w-auto justify-end">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
          />
          <span className="text-slate-500 self-center">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
          />
          <input
            type="text"
            placeholder="ID Tele user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 bg-slate-800/50 border-2 border-slate-700 rounded-xl px-5 py-3 text-white font-bold placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
          />
          <button type="submit" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all flex items-center">
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
