'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';
import StatsCard from '@/components/StatsCard';

export default function AngpaoPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [claimsModal, setClaimsModal] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAngpaos({ page, limit: 30, search });
      setData(res.angpaos);
      setTotal(res.total);
      setStats(res.stats);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus history Angpao ini?')) return;
    try {
      await api.deleteAngpao(id);
      loadData();
    } catch (e) {
      alert('Gagal menghapus histori Angpao: ' + e.message);
    }
  };

  const columns = [
    { key: 'createdAt', label: 'Tanggal', render: (v) => new Date(v).toLocaleString('id-ID') },
    { key: 'angpaoId', label: 'ID Angpao', render: (v) => <span className="font-mono text-xs text-blue-400">{v}</span> },
    { key: 'creatorName', label: 'Kreator', render: (v, row) => <span>{v} <br/><span className="text-xs text-slate-500">{row.creatorTelegramId}</span></span> },
    { key: 'type', label: 'Tipe', render: (v) => <span className={`px-2 py-1 rounded-md text-xs font-bold ${v === 'fixed' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>{v.toUpperCase()}</span> },
    { key: 'totalAmount', label: 'Total Nominal', render: (v) => <span className="font-bold text-slate-200">{v?.toLocaleString()} pt</span> },
    { key: 'status', label: 'Status', render: (_, row) => (
      <span className="text-slate-400">Terbuang: <strong className="text-blue-400">{row.totalAmount - row.remainingAmount} pt</strong><br/>
      Diklaim: <strong>{row.maxClaims - row.remainingClaims}/{row.maxClaims} Org</strong></span>
    )},
    { key: '_id', label: 'Aksi', render: (_, row) => (
      <div className="flex gap-2">
        <button onClick={() => setClaimsModal(row)} className="text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg border border-slate-600 transition-colors shadow-sm">
          Lihat Penerima
        </button>
        <button onClick={() => handleDelete(row._id)} className="text-xs font-bold text-white bg-red-600/20 hover:bg-red-600/40 text-red-500 px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors shadow-sm">
          Hapus
        </button>
      </div>
    )},
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <span className="drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">🧧</span> Histori Angpao
          </h1>
          <p className="text-slate-400 mt-2 text-lg font-medium">Lacak sirkulasi perputaran sedekah antar pemain.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        <StatsCard icon="🧧" title="Total Angpao Disebar" value={stats?.totalCount || 0} color="red" />
        <StatsCard icon="💰" title="Nilai Total Angpao" value={(stats?.totalValue || 0).toLocaleString()} color="yellow" />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Cari ID Angpao, Username kreator..."
          className="bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-400 rounded-xl px-5 py-3.5 text-base font-medium flex-1 max-w-lg focus:border-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/20 shadow-lg transition-all"
        />
        <span className="text-slate-300 font-bold text-base self-center bg-slate-800 px-5 py-3.5 rounded-xl border border-slate-700 shadow-sm">Total: {total} data</span>
      </div>

      <DataTable columns={columns} data={data} loading={loading} />

      <div className="flex gap-4 mt-8 justify-center">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-lg">← Mundur</button>
        <span className="text-base font-bold text-slate-400 self-center px-6 bg-slate-800/50 py-3 rounded-xl">Halaman {page}</span>
        <button disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-lg">Maju →</button>
      </div>

      {/* Modal Claims Detail */}
      {claimsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4">
          <div className="card-dark p-8 w-full max-w-lg relative max-h-[90vh] flex flex-col">
            <div className="mb-6">
              <h2 className="font-black text-2xl text-white mb-2 flex items-center gap-2">🧧 Daftar Penerima</h2>
              <p className="text-slate-400 text-sm">
                ID: <span className="font-mono text-blue-400">{claimsModal.angpaoId}</span><br/>
                Kreator: <strong>{claimsModal.creatorName}</strong>
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              {claimsModal.claims.length === 0 ? (
                <div className="text-center text-slate-500 py-8 font-medium">Belum ada yang merebut angpao ini.</div>
              ) : (
                claimsModal.claims.map((c, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-800 border border-slate-700 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-700 text-slate-300 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs">{i+1}</div>
                      <div>
                        <div className="font-bold text-white text-sm">{c.username}</div>
                        <div className="text-xs text-slate-400 font-mono">{c.telegramId}</div>
                      </div>
                    </div>
                    <div className="text-emerald-400 font-black text-sm">+{c.amount.toLocaleString()} pt</div>
                  </div>
                ))
              )}
            </div>
            
            <button onClick={() => setClaimsModal(null)} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-xl text-base font-bold transition-colors">Tutup Jendela</button>
          </div>
        </div>
      )}
    </div>
  );
}
