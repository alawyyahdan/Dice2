'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function WithdrawCard({ wd, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [adminNote, setAdminNote] = useState('');

  async function approve() {
    if (!confirm(`Approve withdraw ${wd.amount} poin?`)) return;
    setLoading(true);
    try {
      await api.approveWithdraw(wd._id, '');
      onUpdate?.();
    } catch (e) {
      alert('Gagal: ' + e.message);
    }
    setLoading(false);
  }

  async function reject() {
    if (!adminNote.trim()) return alert('Isi alasan penolakan!');
    setLoading(true);
    try {
      await api.rejectWithdraw(wd._id, adminNote);
      onUpdate?.();
    } catch (e) {
      alert('Gagal: ' + e.message);
    }
    setLoading(false);
    setShowReject(false);
  }

  const statusStyles = {
    pending: 'card-dark ring-1 ring-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
    approved: 'card-dark ring-1 ring-emerald-500/50',
    rejected: 'card-dark ring-1 ring-rose-500/50'
  }[wd.status];

  return (
    <div className={`rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden ${statusStyles}`}>
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-2xl font-black text-white tracking-tight">
              {wd.userId?.firstName || wd.telegramId}
            </div>
            <div className="text-sm font-mono text-slate-400 mt-1">ID: {wd.telegramId}</div>
          </div>
          <span className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase border ${
            wd.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
            wd.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {wd.status}
          </span>
        </div>
        
        <div className="p-5 rounded-xl bg-slate-900 border-2 border-slate-700 space-y-3 mb-6">
          <div className="flex justify-between items-end border-b-2 border-slate-800 pb-3 mb-3">
            <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Nominal</span>
            <span className="text-3xl font-black text-white">{wd.amount} <span className="text-base font-bold text-slate-500">poin</span></span>
          </div>
          <div className="text-base grid grid-cols-[100px_1fr] gap-2 text-slate-300">
            <span className="text-slate-500 font-bold">🏦 Bank</span> <span className="font-bold text-white text-right">{wd.bankName}</span>
            <span className="text-slate-500 font-bold">🔢 Rekening</span> <span className="font-mono text-blue-400 text-right font-bold text-lg">{wd.accountNumber}</span>
            <span className="text-slate-500 font-bold">👤 Nama</span> <span className="font-bold text-white text-right">{wd.accountName}</span>
          </div>
        </div>

        <div className="text-sm text-slate-500 mb-6 font-mono font-bold">
          🕐 {new Date(wd.createdAt).toLocaleString('id-ID')}
          {wd.adminNote && (
            <div className="mt-3 p-4 rounded-xl bg-rose-950/30 border border-rose-500/20 text-slate-300 break-words whitespace-pre-wrap">
              <strong className="text-rose-400">Catatan Penolakan:</strong> {wd.adminNote}
            </div>
          )}
        </div>

        {wd.status === 'pending' && (
          <div className="pt-4 border-t-2 border-slate-700">
            <div className="flex gap-4">
              <button
                onClick={approve}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-base font-bold transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
              >
                ✅ APPROVE DANA
              </button>
              <button
                onClick={() => setShowReject(!showReject)}
                disabled={loading}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-xl text-base font-bold transition-colors disabled:opacity-50"
              >
                ❌ TOLAK
              </button>
            </div>
            {showReject && (
              <div className="mt-4 p-5 bg-slate-900 border-2 border-slate-700 rounded-xl">
                <input
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Alasan penolakan (WAJIB)..."
                  className="w-full bg-slate-800 border-2 border-slate-600 rounded-lg px-4 py-3 text-base font-medium mb-4 text-white placeholder-slate-500 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 outline-none transition-all"
                />
                <button
                  onClick={reject}
                  disabled={loading}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-lg text-base font-bold shadow-lg shadow-rose-600/30 transition-colors uppercase tracking-widest"
                >
                  Konfirmasi Penolakan
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
