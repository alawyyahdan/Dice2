'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ amount: '', note: '', includeTurnover: false });
  const [bankModal, setBankModal] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getUsers({ page, limit: 50, search });
      setUsers(data.users);
      setTotal(data.total);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleAdjust() {
    try {
      await api.adjustBalance(adjustModal.telegramId, Number(adjustForm.amount), adjustForm.note, adjustForm.includeTurnover);
      alert('✅ Saldo berhasil diubah!');
      setAdjustModal(null);
      setAdjustForm({ amount: '', note: '', includeTurnover: false });
      loadUsers();
    } catch (e) { alert('Gagal: ' + e.message); }
  }

  async function handleBan(row) {
    if (!confirm(`Yakin ingin ${row.isBanned ? 'UNBAN' : 'BAN'} user ini?`)) return;
    try {
      await api.banUser(row.telegramId);
      loadUsers();
    } catch (e) { alert('Gagal: ' + e.message); }
  }

  async function handleDelete(row) {
    if (!confirm('Peringatan Keras!\nYakin ingin MENGHAPUS user ini beserta SELURUH histori taruhannya secara permanen?')) return;
    try {
      await api.deleteUser(row.telegramId);
      loadUsers();
    } catch (e) { alert('Gagal: ' + e.message); }
  }

  async function handleDeleteBank(telegramId, accountNumber) {
    if (!confirm('Yakin ingin menghapus rekening bank ini? Peringatkan User agar menambahkan rekening baru untuk kelancaran Withdraw.')) return;
    try {
      const res = await api.deleteBank(telegramId, accountNumber);
      alert('✅ Berhasil dihapus oleh Admin!');
      setBankModal(prev => ({ ...prev, banks: res.banks }));
      loadUsers();
    } catch (e) { alert('Gagal: ' + e.message); }
  }

  const columns = [
    { key: 'telegramId', label: 'ID', render: (v) => <span className="text-[12px] break-all">{v}</span> },
    { key: 'username', label: 'User', render: (v) => v ? <span className="break-all">@{v}</span> : '-' },
    { key: 'firstName', label: 'Nama', render: (v) => <span className="line-clamp-2">{v}</span> },
    { key: 'balance', label: 'Saldo', render: (v) => `${(v || 0).toLocaleString()} pt` },
    { key: 'turnover', label: 'Total Bet', render: (v) => `${(v || 0).toLocaleString()} pt` },
    { key: 'totalDeposit', label: 'Depo', render: (v) => `${(v || 0).toLocaleString()}` },
    { key: 'isBanned', label: 'Status', render: (v) => v ? <span className="text-rose-400 font-bold">Banned</span> : <span className="text-emerald-400">Active</span> },
    {
      key: 'turnoverRequired', label: 'Sisa TO', render: (_, row) => {
        const sisa = Math.max(0, row.turnoverRequired || 0);
        return sisa === 0 ? <span className="text-emerald-400 font-bold">LUNAS</span> : <span className="text-amber-400 font-bold">{sisa.toLocaleString()} pt</span>;
      }
    },
    { key: 'createdAt', label: 'Tanggal Join', render: (v) => v ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-' },
    { key: 'lastActive', label: 'Terakhir Aktif', render: (v) => v ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-' },
    {
      key: '_id', label: 'Aksi', render: (_, row) => (
        <div className="flex gap-1.5 items-center flex-wrap">
          <button onClick={() => setBankModal(row)} className="text-emerald-400 hover:text-emerald-300 text-xs font-bold bg-emerald-500/10 px-2 py-1 border border-emerald-500/20 rounded shadow-sm">
            Bank
          </button>
          <button onClick={() => setAdjustModal(row)} className="text-blue-400 hover:text-blue-300 text-xs font-bold bg-blue-500/10 px-2 py-1 border border-blue-500/20 rounded shadow-sm">
            Saldo
          </button>
          <button onClick={() => handleBan(row)} className="text-amber-400 hover:text-amber-300 text-xs font-bold bg-amber-500/10 px-2 py-1 border border-amber-500/20 rounded shadow-sm">
            {row.isBanned ? 'Unban' : 'Ban'}
          </button>
          <button onClick={() => handleDelete(row)} className="text-rose-400 hover:text-rose-300 text-xs font-bold bg-rose-500/10 px-2 py-1 border border-rose-500/20 rounded shadow-sm">
            Hapus
          </button>
        </div>
      )
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-black text-white tracking-tight mb-8">👥 Data Users</h1>
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="🔍 Cari username / Telegram ID..."
          className="bg-slate-800 border-2 border-slate-700 text-white placeholder-slate-400 rounded-xl px-5 py-3.5 text-base font-medium flex-1 max-w-lg focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-lg transition-all"
        />
        <span className="text-slate-300 font-bold text-base self-center bg-slate-800 px-5 py-3.5 rounded-xl border border-slate-700 shadow-sm">Total: {total} user</span>
      </div>

      <DataTable columns={columns} data={users} loading={loading} />

      <div className="flex gap-4 mt-8 justify-center">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-lg">← Mundur</button>
        <span className="text-base font-bold text-slate-400 self-center px-6 bg-slate-800/50 py-3 rounded-xl">Halaman {page}</span>
        <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-lg">Maju →</button>
      </div>

      {/* Modal Adjust */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4">
          <div className="card-dark p-8 w-full max-w-md relative">
            <h2 className="font-black text-2xl text-white mb-2">💰 Adjust Saldo</h2>
            <p className="text-base font-medium text-slate-400 mb-6">User: <span className="text-white">{adjustModal.firstName}</span> — Saldo: <span className="text-blue-400 font-bold">{adjustModal.balance}</span></p>
            <input
              type="number"
              value={adjustForm.amount}
              onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
              placeholder="Nominal (+ tambah / - kurang)"
              className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-5 py-4 text-base font-bold mb-4 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
            />
            <input
              value={adjustForm.note}
              onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
              placeholder="Keterangan Admin (opsional)"
              className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-5 py-4 text-base font-bold mb-4 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
            />
            <div className="flex items-start gap-4 mb-8 bg-slate-800/40 p-5 border border-slate-700/60 rounded-xl cursor-pointer" onClick={() => setAdjustForm({ ...adjustForm, includeTurnover: !adjustForm.includeTurnover })}>
              <input
                type="checkbox"
                id="includeTo"
                checked={adjustForm.includeTurnover}
                onChange={(e) => setAdjustForm({ ...adjustForm, includeTurnover: e.target.checked })}
                onClick={(e) => e.stopPropagation()}
                className="w-6 h-6 rounded bg-slate-900 border-slate-600 text-blue-500 focus:ring-blue-500/30 accent-blue-500 mt-1 cursor-pointer"
              />
              <label htmlFor="includeTo" className="text-sm font-bold text-slate-300 cursor-pointer select-none">
                Tambahkan Beban Turnover (TO)
                <div className="text-xs text-slate-500 font-normal mt-1 leading-relaxed">
                  Centang opsi ini jika saldo tambahan berasal dari Deposit Manual / Ganti rugi error, agar user harus bermain memutar saldo tersebut (2x) sebelum bisa Withdraw.
                </div>
              </label>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setAdjustModal(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white border-2 border-transparent py-4 rounded-xl text-base font-bold transition-colors">Batal</button>
              <button onClick={handleAdjust} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-base font-bold transition-colors shadow-lg shadow-blue-500/30">Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bank */}
      {bankModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4">
          <div className="card-dark p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
            <h2 className="font-black text-2xl text-white mb-2">💳 Manajemen Rekening Bank</h2>
            <p className="text-base font-medium text-slate-400 mb-6">User: <span className="text-white">{bankModal.firstName}</span></p>

            <div className="flex flex-col gap-4 mb-8">
              {(!bankModal.banks || bankModal.banks.length === 0) ? (
                <div className="text-slate-500 text-center py-4 bg-slate-900/50 rounded-xl border border-slate-700/50">Belum ada rekening yang ditautkan.</div>
              ) : (
                bankModal.banks.map((b, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-800 border border-slate-700 p-4 rounded-xl">
                    <div>
                      <div className="text-white font-bold">{b.bankName}</div>
                      <div className="text-slate-400 text-sm">{b.accountNumber} <br />a/n {b.accountName}</div>
                    </div>
                    <button onClick={() => handleDeleteBank(bankModal.telegramId, b.accountNumber)} className="bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-rose-500/30 cursor-pointer">
                      Hapus
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-4">
              <button onClick={() => setBankModal(null)} className="w-full bg-slate-700 hover:bg-slate-600 text-white border-2 border-transparent py-4 rounded-xl text-base font-bold transition-colors">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
