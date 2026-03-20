'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';

const TABS = ['all', 'approved', 'pending', 'rejected'];

export default function WithdrawPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [withdraws, setWithdraws] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalApproved: 0, totalPending: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [providerType, setProviderType] = useState('none');

  const loadWithdraws = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getWithdraws({ 
        status: activeTab !== 'all' ? activeTab : '', 
        page, 
        limit: 50, 
        search, 
        dateFrom, 
        dateTo 
      });
      setWithdraws(data.requests || []);
      setTotal(data.total || 0);
      if (data.stats) {
        setStats({ 
          totalApproved: data.stats.approved || 0, 
          totalPending: data.stats.pending || 0 
        });
      }
      if (data.providerType) {
        setProviderType(data.providerType);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [activeTab, page, search, dateFrom, dateTo]);

  useEffect(() => { loadWithdraws(); }, [loadWithdraws]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadWithdraws();
  };

  const handleAction = async (id, action) => {
    const note = prompt(`Masukkan catatan admin untuk ${action.toUpperCase()} (opsional):`);
    if (note === null) return; // cancel prompt
    
    if (!confirm(`Apakah Anda yakin ingin ${action.toUpperCase()} penarikan ini?`)) return;
    
    try {
      if (action === 'approve') {
        await api.approveWithdraw(id, note);
      } else {
        await api.rejectWithdraw(id, note);
      }
      loadWithdraws();
    } catch (e) {
      alert('❌ Gagal: ' + (e.response?.data?.error || e.message));
    }
  };

  const columns = [
    { key: 'createdAt', label: 'WAKTU', render: (_, d) => <span className="text-slate-400 break-words">{new Date(d.createdAt).toLocaleString('id-ID')}</span> },
    { key: 'telegramId', label: 'ID TELE', render: (_, d) => <span className="font-mono text-blue-400 break-words">{d.telegramId}</span> },
    { key: 'userId', label: 'USER', render: (_, d) => <span className="font-bold text-slate-200 line-clamp-2">{d.userId?.firstName || d.userId?.username || '-'}</span> },
    { key: 'amount', label: 'NOMINAL', render: (_, d) => <span className="font-black text-rose-400 text-xl break-words">-{d.amount}</span> },
    { key: 'bank', label: 'REKENING', render: (_, d) => (
      <div className="flex flex-col text-xs space-y-0.5">
        <span className="font-black text-slate-100 uppercase">{d.bankName}</span>
        <span className="font-mono text-slate-400 font-bold">{d.accountNumber}</span>
        <span className="text-slate-500 font-medium uppercase truncate max-w-[150px]">{d.accountName}</span>
      </div>
    )},
    { key: 'adminNote', label: 'CATATAN', render: (_, d) => <span className="text-slate-500 text-sm font-medium italic break-words">{d.adminNote || '-'}</span> },
    { 
      key: 'status',
      label: 'STATUS', 
      render: (_, d) => (
        <span className={`px-4 py-2 rounded-full text-sm font-black uppercase inline-flex items-center justify-center min-w-[120px] ${
          d.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
          d.status === 'rejected' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_10px_rgba(225,29,72,0.3)]' :
          'bg-amber-500/20 text-amber-500 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
        }`}>
          {d.status === 'approved' ? '✅ APPROVED' : d.status === 'rejected' ? '❌ REJECTED' : '⏳ PENDING'}
        </span>
      ) 
    },
    {
      key: 'aksi',
      label: 'AKSI',
      render: (_, d) => d.status === 'pending' ? (
        <div className="flex gap-2">
          <button onClick={() => handleAction(d._id, 'approve')} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-lg transition-colors uppercase tracking-wide">
            {providerType === 'sitranfer' ? 'TERIMA' : 'TERKIRIM'}
          </button>
          <button onClick={() => handleAction(d._id, 'reject')} className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-lg transition-colors uppercase tracking-wide">
            TOLAK
          </button>
        </div>
      ) : <span className="text-slate-500 font-bold text-sm">-</span>
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">💸 Data Withdraw</h1>
          <p className="text-slate-400 mt-2 text-base font-medium">Pantau riwayat penarikan saldo secara global.</p>
        </div>

        <div className="flex gap-4 items-start">
          {/* Stats Boxes mirroring Deposit page layout */}
          <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest relative z-10">Total Approved</p>
            <p className="text-3xl font-black text-emerald-400 mt-2 relative z-10">{stats.totalApproved.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest relative z-10">Total Pending</p>
            <p className="text-3xl font-black text-amber-400 mt-2 relative z-10">{stats.totalPending.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
        {/* Tabs Bar mirroring Deposit style */}
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

        {/* Filters Bar mirroring Deposit style */}
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
          <div className="p-12 text-center text-slate-400 font-bold text-xl animate-pulse">⚙️ Melakukan sinkronisasi data withdraw...</div>
        ) : (
          <DataTable columns={columns} data={withdraws} />
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
