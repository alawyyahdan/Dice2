'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  return document.cookie.match(/(?:^|; )admin_token=([^;]*)/)?.[1]
    ? decodeURIComponent(document.cookie.match(/(?:^|; )admin_token=([^;]*)/)[1])
    : null;
}

export default function PromosiPage() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPromo, setCurrentPromo] = useState(null);
  const [formData, setFormData] = useState({
    title: '', bannerUrl: '', description: '', startDate: '', endDate: '', isActive: true
  });
  const textareaRef = useRef(null);

  // Broadcast modal state
  const [broadcastModal, setBroadcastModal] = useState(null); // promo object or null
  const [broadcastType, setBroadcastType] = useState('users');
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(null); // promo._id or null

  const loadPromotions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPromotions();
      setPromotions(data.promotions || []);
    } catch (e) { console.error('Gagal load promotions:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadPromotions(); }, [loadPromotions]);

  function handleOpenModal(promo = null) {
    if (promo) {
      setCurrentPromo(promo);
      setFormData({
        title: promo.title,
        bannerUrl: promo.bannerUrl,
        description: promo.description,
        startDate: new Date(promo.startDate).toISOString().slice(0, 16),
        endDate: new Date(promo.endDate).toISOString().slice(0, 16),
        isActive: promo.isActive
      });
    } else {
      setCurrentPromo(null);
      setFormData({
        title: '', bannerUrl: '', description: '', startDate: '', endDate: '', isActive: true
      });
    }
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      if (currentPromo) {
        await api.updatePromotion(currentPromo._id, formData);
      } else {
        await api.createPromotion(formData);
      }
      setModalOpen(false);
      loadPromotions();
    } catch (err) {
      alert('Gagal menyimpan promosi: ' + err.message);
    }
  }

  async function handleDelete(promo) {
    if (!confirm(`Yakin ingin menghapus promosi "${promo.title}"?`)) return;
    try {
      await api.deletePromotion(promo._id);
      loadPromotions();
    } catch (err) { alert('Gagal hapus: ' + err.message); }
  }
  
  async function handleToggle(promo) {
    try {
      await api.updatePromotion(promo._id, { ...promo, isActive: !promo.isActive });
      loadPromotions();
    } catch (err) { alert('Gagal update status: ' + err.message); }
  }

  async function handleBroadcast() {
    if (!broadcastModal) return;
    setBroadcastLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/promotions/${broadcastModal._id}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ type: broadcastType })
      });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch(e) {}
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}: ${text.slice(0, 100)}`);
      alert(`✅ Broadcast promosi "${broadcastModal.title}" berhasil dimulai! Target: ${data.broadcast?.targetCount || '?'} penerima.`);
      setBroadcastModal(null);
    } catch(e) {
      alert('❌ Error: ' + e.message);
    }
    setBroadcastLoading(false);
  }

  async function handlePostChannel(promo) {
    if (!confirm(`Kirim promosi "${promo.title}" ke Channel Telegram? Ini akan muncul di riwayat Channel Manager.`)) return;
    setChannelLoading(promo._id);
    try {
      const res = await fetch(`${API_URL}/api/promotions/${promo._id}/post-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }
      });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch(e) {}
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}: ${text.slice(0, 100)}`);
      alert(`✅ Promosi "${promo.title}" berhasil diposting ke channel dan tercatat di Channel Manager!`);
    } catch(e) {
      alert('❌ Error: ' + e.message);
    }
    setChannelLoading(null);
  }

  function insertText(prefix, suffix) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.description;
    const newText = text.substring(0, start) + prefix + text.substring(start, end) + suffix + text.substring(end);
    setFormData({ ...formData, description: newText });
    
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + prefix.length + (end - start);
      textarea.focus();
    }, 0);
  }

  const columns = [
    { key: 'title', label: 'Judul Promosi', render: (v) => <span className="font-bold text-white">{v}</span> },
    { key: 'bannerUrl', label: 'Banner', render: (v) => <img src={v} alt="banner" className="h-10 w-auto rounded object-cover border border-slate-700" /> },
    { key: 'startDate', label: 'Mulai', render: (v) => new Date(v).toLocaleString('id-ID') },
    { key: 'endDate', label: 'Berakhir', render: (v) => new Date(v).toLocaleString('id-ID') },
    { key: 'isActive', label: 'Status', render: (v) => v ? 
      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold">AKTIF</span> : 
      <span className="px-2.5 py-1 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-lg text-xs font-bold">NONAKTIF</span> 
    },
    { key: '_id', label: 'Aksi', render: (_, row) => (
      <div className="flex gap-2 items-center flex-wrap">
        <button onClick={() => handleToggle(row)} className={`text-xs font-bold px-3 py-1.5 border rounded shadow-sm transition-colors ${row.isActive ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
          {row.isActive ? 'Matikan' : 'Aktifkan'}
        </button>
        <button onClick={() => handleOpenModal(row)} className="text-blue-400 text-xs font-bold px-3 py-1.5 border border-blue-500/20 bg-blue-500/10 rounded">Edit</button>
        <button 
          onClick={() => { setBroadcastModal(row); setBroadcastType('users'); }}
          className="text-purple-400 text-xs font-bold px-3 py-1.5 border border-purple-500/20 bg-purple-500/10 rounded hover:bg-purple-500/20 transition"
        >📢 Broadcast</button>
        <button 
          onClick={() => handlePostChannel(row)}
          disabled={channelLoading === row._id}
          className="text-cyan-400 text-xs font-bold px-3 py-1.5 border border-cyan-500/20 bg-cyan-500/10 rounded hover:bg-cyan-500/20 transition disabled:opacity-50"
        >{channelLoading === row._id ? '⏳...' : '📺 Post Channel'}</button>
        <button onClick={() => handleDelete(row)} className="text-rose-400 text-xs font-bold px-3 py-1.5 border border-rose-500/20 bg-rose-500/10 rounded">Hapus</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">📢 Manajemen Promosi</h1>
          <p className="text-slate-400 text-sm">Kelola banner dan deskripsi promosi yang tampil di Mini App.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition shadow-[0_4px_15px_rgba(37,99,235,0.4)]">
          + Tambah Promosi
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-medium">⚙️ Memuat data...</div>
      ) : (
        <DataTable data={promotions} columns={columns} />
      )}

      {/* Broadcast Type Picker Modal */}
      {broadcastModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-black text-white">📢 Broadcast Promosi</h2>
              <button onClick={() => setBroadcastModal(null)} className="text-slate-400 hover:text-white text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-300 text-sm font-bold">{broadcastModal.title}</p>
              <p className="text-slate-500 text-xs">Pilih target penerima broadcast promosi ini:</p>
              <div className="space-y-2">
                {[
                  { value: 'users', label: '👤 Semua User (Personal Chat)' },
                  { value: 'groups', label: '👥 Semua Grup Aktif' },
                  { value: 'both', label: '🌐 User + Grup (Semua)' }
                ].map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${broadcastType === opt.value ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}>
                    <input type="radio" value={opt.value} checked={broadcastType === opt.value} onChange={() => setBroadcastType(opt.value)} className="accent-purple-500" />
                    <span className="text-sm font-bold text-slate-200">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-5 border-t border-slate-800 flex justify-end gap-3">
              <button onClick={() => setBroadcastModal(null)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 font-bold text-sm transition">Batal</button>
              <button
                onClick={handleBroadcast}
                disabled={broadcastLoading}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm transition disabled:opacity-50 shadow-[0_4px_15px_rgba(147,51,234,0.4)]"
              >
                {broadcastLoading ? '⏳ Memproses...' : '🚀 Mulai Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-xl font-black text-white">{currentPromo ? 'Edit Promosi' : 'Tambah Promosi'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white font-bold text-xl">✕</button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Judul Promosi</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Contoh: Bonus Deposit Habis Gajian!" />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Banner URL (Image Link)</label>
                <input required type="url" value={formData.bannerUrl} onChange={e => setFormData({...formData, bannerUrl: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="https://example.com/banner.jpg" />
                {formData.bannerUrl && <img src={formData.bannerUrl} alt="Preview" className="mt-3 h-24 object-cover rounded-lg border border-slate-700" />}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Tanggal Mulai</label>
                  <input required type="datetime-local" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Tanggal Berakhir</label>
                  <input required type="datetime-local" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Deskripsi (Mendukung HTML)</label>
                
                {/* Custom Rich Text Toolbar */}
                <div className="flex gap-2 mb-2 bg-slate-800 p-2 rounded-t-xl border border-slate-700 border-b-0 overflow-x-auto">
                  <button type="button" onClick={() => insertText('<b>', '</b>')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white font-bold text-sm">B</button>
                  <button type="button" onClick={() => insertText('<i>', '</i>')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white italic text-sm">I</button>
                  <button type="button" onClick={() => insertText('<u>', '</u>')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white underline text-sm">U</button>
                  <button type="button" onClick={() => insertText('<del>', '</del>')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white line-through text-sm">S</button>
                  <button type="button" onClick={() => insertText('<br/>\n', '')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm">↵ Baris</button>
                  <button type="button" onClick={() => insertText('<hr class="border-slate-700 my-4"/>\n', '')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm">― Garis</button>
                  <button type="button" onClick={() => insertText('🎉 ', '')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm">🎉</button>
                  <button type="button" onClick={() => insertText('🔥 ', '')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm">🔥</button>
                  <button type="button" onClick={() => insertText('💰 ', '')} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm">💰</button>
                </div>
                
                <textarea 
                  ref={textareaRef}
                  required 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  className="w-full bg-slate-800 border border-slate-700 rounded-b-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 h-40 font-mono text-sm leading-relaxed" 
                  placeholder="Deskripsi promosi di sini..." 
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-600" />
                <label htmlFor="isActive" className="text-sm font-bold text-slate-300 cursor-pointer">Promosi Aktif Secara Publik</label>
              </div>

            </form>
            
            <div className="p-5 border-t border-slate-800 bg-slate-800/30 flex justify-end gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition">Batal</button>
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition shadow-lg">Simpan Promosi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
