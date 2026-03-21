'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';
import GroupStatsModal from '@/components/GroupStatsModal';

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsModalGroup, setStatsModalGroup] = useState(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getGroups();
      setGroups(data);
    } catch (e) { console.error('Gagal load groups:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  async function handleToggleStatus(group) {
    if (!confirm(`Yakin ingin ${group.isActive ? 'MEMATIKAN' : 'MENGAKTIFKAN'} bot di grup: ${group.title}?\n\n(Jika dimatikan, semua ronde baru akan berhenti dan taruhan tidak akan diproses sama sekali).`)) return;
    try {
      await api.toggleGroup(group._id);
      loadGroups();
    } catch (e) { alert('Gagal: ' + e.message); }
  }

  async function handleDeleteGroup(group) {
    if (!confirm(`PERINGATAN KERAS! Yakin ingin MENGHAPUS secara permanen grup: ${group.title} dari database?`)) return;
    try {
      await api.deleteGroup(group._id);
      loadGroups();
    } catch (e) { alert('Gagal: ' + e.message); }
  }

  const columns = [
    { key: 'title', label: 'Nama Grup', render: (v) => <span className="font-bold text-white line-clamp-1">{v || 'Unnamed Group'}</span> },
    { key: 'chatId', label: 'Chat ID', render: (v) => <span className="text-[12px] text-slate-400">{v}</span> },
    { key: 'memberCount', label: 'Members', render: (v) => <span className="text-blue-400 font-medium">{v ? v.toLocaleString() : 'N/A'}</span> },
    { key: 'totalVolume', label: 'Volume', render: (v) => <span className="text-emerald-400 font-bold">{(v || 0).toLocaleString()} pt</span> },
    { key: 'addedAt', label: 'Tanggal Join', render: (v) => v ? new Date(v).toLocaleString('id-ID', {day:'2-digit', month:'short', year:'numeric'}) : '-' },
    { key: 'isActive', label: 'Status Bot', render: (v) => v ? 
      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold shadow-sm">ENABLED</span> : 
      <span className="px-2.5 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs font-bold shadow-sm">DISABLED</span> 
    },
    { key: '_id', label: 'Aksi', render: (_, row) => (
      <div className="flex gap-2 items-center flex-wrap">
        <button 
          onClick={() => setStatsModalGroup(row)} 
          className="text-blue-400 hover:text-white text-xs font-bold bg-blue-500/10 hover:bg-blue-500/30 px-3 py-1.5 border border-blue-500/20 rounded shadow-sm transition-colors">
          📊 Statistik
        </button>
        <button 
          onClick={() => handleToggleStatus(row)} 
          className={`text-xs font-bold px-3 py-1.5 border rounded shadow-sm transition-colors ${
            row.isActive 
              ? 'text-orange-400 hover:text-white bg-orange-500/10 hover:bg-orange-500/30 border-orange-500/20' 
              : 'text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/30 border-emerald-500/20'
          }`}>
          {row.isActive ? '❌ Disable' : '✅ Enable'}
        </button>
        <button 
          onClick={() => handleDeleteGroup(row)} 
          className="text-rose-400 hover:text-white text-xs font-bold bg-rose-500/10 hover:bg-rose-500/30 px-3 py-1.5 border border-rose-500/20 rounded shadow-sm transition-colors">
          🗑️ Hapus
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <h1 className="text-3xl font-black text-white tracking-tight mb-4">🏢 Manajemen Grup</h1>
      <p className="text-slate-400 mb-8 max-w-2xl text-sm leading-relaxed">
        Kelola Grup Telegram tempat bot diundang. Anda dapat melihat statistik volume per grup dan mengaktifkan/menonaktifkan bot di dalam grup secara instan (tanpa restart).
      </p>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-medium">⚙️ Memuat data grup...</div>
      ) : (
        <DataTable data={groups} columns={columns} />
      )}

      {/* STATS MODAL */}
      {statsModalGroup && (
        <GroupStatsModal group={statsModalGroup} onClose={() => setStatsModalGroup(null)} />
      )}
    </div>
  );
}
