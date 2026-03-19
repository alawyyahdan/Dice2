'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';

const BET_TYPES = ['', 'B', 'K', 'GA', 'GE', 'BGA', 'BGE', 'KGA', 'KGE', 'J', 'T', 'L', 'P', 'TB', 'DS', 'TS', 'N', 'H', 'S'];

export default function BetsPage() {
  const [bets, setBets] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({});
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ telegramId: '', betType: '', isWin: '', isGroup: '' });
  const [loading, setLoading] = useState(true);

  const loadBets = useCallback(async () => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (filters.telegramId) params.telegramId = filters.telegramId;
    if (filters.betType) params.betType = filters.betType;
    if (filters.isWin !== '') params.isWin = filters.isWin;
    if (filters.isGroup !== '') params.isGroup = filters.isGroup;
    try {
      const data = await api.getBets(params);
      setBets(data.bets);
      setTotal(data.total);
      setStats(data.stats || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { loadBets(); }, [loadBets]);

  const columns = [
    { key: 'createdAt', label: 'Waktu', render: (v) => new Date(v).toLocaleString('id-ID') },
    { key: 'source', label: 'Sumber', render: (_, row) => row.isGroup ? `Grup ${row.groupName || row.groupId}` : 'Bot (Private)' },
    { key: 'telegramId', label: 'User ID' },
    { key: 'betType', label: 'Jenis' },
    { key: 'betAmount', label: 'Nominal', render: (v) => `${(v || 0).toLocaleString()}` },
    { key: 'diceResult', label: 'Dadu', render: (v) => v ? `[${v.join(',')}]` : '-' },
    { key: 'diceTotal', label: 'Total' },
    { key: 'isWin', label: 'Hasil', render: (v) => v ? <span className="text-green-600 font-medium">✅ Menang</span> : <span className="text-red-500">❌ Kalah</span> },
    { key: 'payout', label: 'Payout', render: (v, row) => row.isWin ? `+${(v || 0).toLocaleString()}` : `-${(row.betAmount || 0).toLocaleString()}` },
  ];

  return (
    <div>
      <h1 className="text-3xl font-black text-white tracking-tight mb-8">🎲 History Taruhan</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Bet', value: stats.totalBet?.toLocaleString(), color: 'text-blue-400' },
          { label: 'Total Win', value: stats.totalWin?.toLocaleString(), color: 'text-emerald-400' },
          { label: 'Total Lose', value: stats.totalLose?.toLocaleString(), color: 'text-rose-400' },
          { label: 'Profit House', value: Math.abs(stats.totalProfit || 0).toLocaleString() + (stats.totalProfit < 0 ? ' 🔴' : ' 🟢'), color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="card-dark p-6 text-center">
            <div className={`text-3xl font-black ${s.color} tracking-tight`}>{s.value || 0}</div>
            <div className="text-[13px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-8 p-6 card-dark items-center">
        <input value={filters.telegramId} onChange={(e) => setFilters({ ...filters, telegramId: e.target.value })}
          placeholder="Telegram ID Pemain..." className="w-full sm:w-auto bg-slate-900 border-2 border-slate-700 text-white placeholder-slate-500 rounded-xl px-5 py-3.5 text-base font-medium focus:border-blue-500 outline-none transition-all flex-1 min-w-[200px]" />
        
        <select value={filters.betType} onChange={(e) => setFilters({ ...filters, betType: e.target.value })}
          className="w-full sm:w-auto bg-slate-900 border-2 border-slate-700 text-white font-bold rounded-xl px-4 py-3.5 text-base focus:border-blue-500 outline-none appearance-none cursor-pointer">
          {BET_TYPES.map(t => <option key={t} value={t}>{t || 'Semua Jenis'}</option>)}
        </select>
        
        <select value={filters.isWin} onChange={(e) => setFilters({ ...filters, isWin: e.target.value })}
          className="w-full sm:w-auto bg-slate-900 border-2 border-slate-700 text-white font-bold rounded-xl px-4 py-3.5 text-base focus:border-blue-500 outline-none appearance-none cursor-pointer">
          <option value="">Status Bet (Semua)</option>
          <option value="true">✅ Menang</option>
          <option value="false">❌ Kalah</option>
        </select>
        
        <select value={filters.isGroup} onChange={(e) => setFilters({ ...filters, isGroup: e.target.value })}
          className="w-full sm:w-auto bg-slate-900 border-2 border-slate-700 text-white font-bold rounded-xl px-4 py-3.5 text-base focus:border-blue-500 outline-none appearance-none cursor-pointer">
          <option value="">Semua Sumber</option>
          <option value="true">👥 Dari Grup</option>
          <option value="false">🤖 Dari Bot (Private)</option>
        </select>
      </div>

      <DataTable columns={columns} data={bets} loading={loading} />

      <div className="flex gap-4 mt-8 justify-center">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-lg">← Mundur</button>
        <span className="text-base font-bold text-slate-400 self-center px-6 bg-slate-800/50 py-3 rounded-xl">Halaman {page}</span>
        <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-lg">Maju →</button>
      </div>
    </div>
  );
}
