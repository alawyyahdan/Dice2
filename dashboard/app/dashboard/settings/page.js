'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // 'odds', 'bounds', 'strings'

  // Form State
  const [formOdds, setFormOdds] = useState({});
  const [formBounds, setFormBounds] = useState({});
  const [formStrings, setFormStrings] = useState({});
  const [systemInfo, setSystemInfo] = useState({ uptime: 0, botUptime: 0, groupUptime: 0 });

  // General Settings State
  const [minBet, setMinBet] = useState(1);
  const [roundDuration, setRoundDuration] = useState(1);
  const [isBotActive, setIsBotActive] = useState(true);
  const [isGroupActive, setIsGroupActive] = useState(true);

  const STRING_LABELS = {
    welcome: 'Pesan Selamat Datang (/start)',
    saldo_info: 'Pesan Info Saldo (tombol Menu)',
    bet_saldo_kurang: 'Saldo tidak cukup',
    bet_max_exceeded: 'Melebihi max bet',
    bet_anti_hedging: 'Peringatan anti-hedging',
    bet_ditutup: 'Taruhan sedang ditutup (Grup)',
    bet_grup_success: 'Konfirmasi bet diterima (Grup)',
    bet_pc_confirm: 'Konfirmasi taruhan sebelum roll (Private)',
    cashback_claimed: 'Cashback berhasil klaim',
    cashback_empty: 'Tidak ada cashback',
    roll_timeout: 'Timeout roll dadu (2 menit)',
    roll_user_start: 'Petunjuk roll dadu oleh user',
    result_win: 'Hasil MENANG',
    result_lose: 'Hasil KALAH',
    round_warning: 'Peringatan 10 detik tutup ronde (Grup)',
    round_close: 'Pesan tutup ronde (Grup)',
    round_open: 'Pesan buka ronde baru (Grup)',
    tf_success: 'Transfer berhasil',
    tf_saldo_kurang: 'Saldo kurang saat transfer',
    angpao_caption: 'Caption Angpao dibagikan',
    angpao_claim_success: 'Pop-up klaim Angpao berhasil',
    angpao_habis: 'Pop-up Angpao sudah habis',
    angpao_sudah_klaim: 'Pop-up sudah pernah klaim',
    cs_contact: 'Pesan Kontak CS (/kontak)',
    maintenance_msg: 'Pesan Sedang Maintenance',
  };

  useEffect(() => {
    loadSettings();
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.getSystemStatus();
      setSystemInfo(data);
    } catch (e) {}
  };

  const loadSettings = async () => {
    try {
      const { settings: data } = await api.getSettings();
      setSettings(data);
      setFormOdds(data.odds || {});
      setFormBounds(data.bounds || {});
      setFormStrings(data.strings || {});
      setMinBet(data.minBet || 1);
      setRoundDuration(data.roundDuration || 1);
      setIsBotActive(data.isBotActive !== false);
      setIsGroupActive(data.isGroupActive !== false);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async (sectionKey) => {
    setSaving(true);
    try {
      let payload = {};
      if (sectionKey === 'odds') payload = { odds: formOdds };
      if (sectionKey === 'bounds') payload = { bounds: formBounds };
      if (sectionKey === 'strings') payload = { strings: formStrings };
      if (sectionKey === 'general') payload = { minBet, roundDuration };
      if (sectionKey === 'bot_status') payload = { isBotActive, isGroupActive };

      await api.updateSettings(payload);
      alert('✅ Pengaturan berhasil disimpan!');
      loadSettings();
      setActiveSection(null); // close the sliding popup
    } catch (e) {
      alert('❌ Gagal menyimpan: ' + e.message);
    }
    setSaving(false);
  };

  const toggleSection = (section) => {
    setActiveSection(activeSection === section ? null : section);
  };

  if (loading) return <div className="text-center py-24 text-slate-400 font-bold text-2xl animate-pulse">⚙️ Memuat Konfigurasi Server...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-lg">⚙️ Dynamic Game Settings</h1>
        <p className="text-slate-400 mt-3 text-lg font-medium">Ubah logika inti permainan dan batas modal tanpa perlu mematikan server.</p>
      </div>

      {/* BUTTONS FOR POPUPS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button 
          onClick={() => toggleSection('odds')}
          className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 shadow-xl hover:-translate-y-1 hover:shadow-2xl ${
            activeSection === 'odds' ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <span className="text-4xl">🎲</span>
          <span className="text-xl font-bold text-white">Odds & Payouts</span>
          <span className="text-sm text-slate-400 text-center">Atur perkalian hadiah dari x2 sampai x150</span>
          <div className={`mt-2 transition-transform duration-300 ${activeSection==='odds' ? 'rotate-180' : ''}`}>▼</div>
        </button>

        <button 
          onClick={() => toggleSection('bounds')}
          className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 shadow-xl hover:-translate-y-1 hover:shadow-2xl ${
            activeSection === 'bounds' ? 'bg-emerald-600/20 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <span className="text-4xl">🛑</span>
          <span className="text-xl font-bold text-white">Max Bet Limits</span>
          <span className="text-sm text-slate-400 text-center">Batasi modal maksimal per taruhan</span>
          <div className={`mt-2 transition-transform duration-300 ${activeSection==='bounds' ? 'rotate-180' : ''}`}>▼</div>
        </button>

        <button 
          onClick={() => toggleSection('strings')}
          className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 shadow-xl hover:-translate-y-1 hover:shadow-2xl ${
            activeSection === 'strings' ? 'bg-purple-600/20 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <span className="text-4xl">💬</span>
          <span className="text-xl font-bold text-white">Teks Bot (Strings)</span>
          <span className="text-sm text-slate-400 text-center">Edit semua pesan yang dikirim bot ke Telegram</span>
          <div className={`mt-2 transition-transform duration-300 ${activeSection==='strings' ? 'rotate-180' : ''}`}>▼</div>
        </button>

        <button 
          onClick={() => toggleSection('system')}
          className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 shadow-xl hover:-translate-y-1 hover:shadow-2xl ${
            activeSection === 'system' ? 'bg-rose-600/20 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <span className="text-4xl">⚡</span>
          <span className="text-xl font-bold text-white">System & Bot Control</span>
          <span className="text-sm text-slate-400 text-center">Stop/Start Bot Game & Atur Minimal Bet</span>
          <div className={`mt-2 transition-transform duration-300 ${activeSection==='system' ? 'rotate-180' : ''}`}>▼</div>
        </button>
      </div>

      {/* SLIDING POPUPS (Accordion Style) */}
      
      {/* 1. ODDS POPUP */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeSection === 'odds' ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="card-dark p-8 md:p-10 border-2 border-blue-500/50 shadow-[0_10px_40px_rgba(59,130,246,0.15)] mt-4">
          <h2 className="text-3xl font-black text-white mb-8 border-b border-slate-700 pb-5">Konfigurasi Perkalian Hadiah (Odds)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            {Object.entries(formOdds).map(([key, val]) => (
               <div key={key} className="flex flex-col gap-3">
                 <label className="text-sm font-black text-blue-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</label>
                 <div className="relative">
                   <div className="absolute left-0 top-0 bottom-0 w-14 bg-slate-800 border-r border-slate-700 rounded-l-xl flex items-center justify-center">
                     <span className="text-slate-400 font-bold text-lg">x</span>
                   </div>
                   <input 
                     type="number" step="0.01"
                     value={val}
                     onChange={(e) => setFormOdds({...formOdds, [key]: parseFloat(e.target.value)})}
                     className="w-full bg-slate-900 border-2 border-slate-700 hover:border-slate-600 rounded-xl py-4 pl-20 pr-5 text-white font-bold text-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none"
                   />
                 </div>
               </div>
            ))}
          </div>
          <div className="mt-12 pt-8 border-t border-slate-700 flex justify-end">
            <button disabled={saving} onClick={() => handleSave('odds')} className="px-10 py-5 text-xl font-black bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-2xl shadow-xl hover:shadow-blue-500/40 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center gap-3">
              {saving ? '⏳ Menyimpan...' : '💾 SIMPAN ODDS'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. BOUNDS POPUP */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeSection === 'bounds' ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="card-dark p-8 md:p-10 border-2 border-emerald-500/50 shadow-[0_10px_40px_rgba(16,185,129,0.15)] mt-4">
          <h2 className="text-3xl font-black text-white mb-8 border-b border-slate-700 pb-5">Batas Maksimal Taruhan (Max Bet)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            {Object.entries(formBounds).map(([key, val]) => (
               <div key={key} className="flex flex-col gap-3">
                 <label className="text-sm font-black text-emerald-400 uppercase tracking-widest">{key.replace('max', 'Limit ').replace(/_/g, ' ')}</label>
                 <div className="relative">
                   <input 
                     type="number" 
                     value={val}
                     onChange={(e) => setFormBounds({...formBounds, [key]: parseInt(e.target.value)})}
                     className="w-full bg-slate-900 border-2 border-slate-700 hover:border-slate-600 rounded-xl py-4 pl-6 pr-16 text-white font-bold text-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all outline-none"
                   />
                   <div className="absolute right-6 top-1/2 -translate-y-1/2">
                     <span className="text-slate-500 font-bold text-sm">poin</span>
                   </div>
                 </div>
               </div>
            ))}
          </div>
          <div className="mt-12 pt-8 border-t border-slate-700 flex justify-end">
            <button disabled={saving} onClick={() => handleSave('bounds')} className="px-10 py-5 text-xl font-black bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-2xl shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center gap-3">
              {saving ? '⏳ Menyimpan...' : '💾 SIMPAN MAX BET'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. STRINGS POPUP */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeSection === 'strings' ? 'max-h-[9999px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="card-dark p-8 md:p-10 border-2 border-purple-500/50 shadow-[0_10px_40px_rgba(168,85,247,0.15)] mt-4">
          <h2 className="text-3xl font-black text-white mb-2 border-b border-slate-700 pb-5">💬 Editor Pesan Bot</h2>
          <p className="text-slate-400 text-sm mb-8">Format: HTML biasa. Gunakan <code className="bg-slate-900 px-1.5 py-0.5 rounded text-purple-400">&lt;b&gt;bold&lt;/b&gt;</code> <code className="bg-slate-900 px-1.5 py-0.5 rounded text-purple-400">&lt;i&gt;italic&lt;/i&gt;</code> <code className="bg-slate-900 px-1.5 py-0.5 rounded text-purple-400">&lt;code&gt;mono&lt;/code&gt;</code>. Variabel mesin pakai format <code className="bg-slate-900 px-1.5 py-0.5 rounded text-yellow-400">{'{nama}'}</code> dst — jangan dihapus!</p>
          <div className="flex flex-col gap-8">
            {Object.keys(STRING_LABELS).map((key) => (
              <div key={key} className="flex flex-col gap-2">
                <label className="text-sm font-black text-purple-400 uppercase tracking-widest">{STRING_LABELS[key]}</label>
                <div className="text-[11px] text-slate-500 font-mono mb-1">key: {key}</div>
                <textarea
                  rows={3}
                  value={formStrings[key] || ''}
                  onChange={(e) => setFormStrings({...formStrings, [key]: e.target.value})}
                  className="w-full bg-slate-900 border-2 border-slate-700 hover:border-purple-600/50 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 rounded-xl py-3 px-4 text-white font-mono text-sm outline-none transition-all resize-y"
                  placeholder={`Teks untuk: ${STRING_LABELS[key]}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-12 pt-8 border-t border-slate-700 flex justify-end">
            <button disabled={saving} onClick={() => handleSave('strings')} className="px-10 py-5 text-xl font-black bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-2xl shadow-xl hover:shadow-purple-500/40 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center gap-3">
              {saving ? '⏳ Menyimpan...' : '💾 SIMPAN SEMUA TEKS'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 4. SYSTEM POPUP */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeSection === 'system' ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="card-dark p-8 md:p-10 border-2 border-rose-500/50 shadow-[0_10px_40px_rgba(244,63,94,0.15)] mt-4">
          <h2 className="text-3xl font-black text-white mb-8 border-b border-slate-700 pb-5 flex items-center gap-3">
             ⚡ System & Bot Control
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            {/* Left: General Settings */}
            <div className="space-y-8 flex flex-col h-full">
              <h3 className="text-xl font-bold text-slate-300 flex items-center gap-2">
                <span className="text-rose-500">⚙️</span> Pengaturan Umum
              </h3>
              
              <div className="space-y-6 flex-grow">
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">MINIMAL BET (POIN)</label>
                  <input 
                    type="number" 
                    value={minBet}
                    onChange={(e) => setMinBet(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border-2 border-slate-700 hover:border-slate-600 rounded-xl py-4 px-6 text-white font-bold text-lg focus:border-rose-500 outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">DURASI RONDE GRUP</label>
                  <select 
                    value={roundDuration}
                    onChange={(e) => setRoundDuration(parseInt(e.target.value))}
                    className="w-full bg-slate-900 border-2 border-slate-700 hover:border-slate-600 rounded-xl py-4 px-6 text-white font-bold text-lg focus:border-rose-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value={1}>1 Menit (Standard)</option>
                    <option value={2}>2 Menit</option>
                    <option value={3}>3 Menit</option>
                    <option value={5}>5 Menit</option>
                  </select>
                </div>
              </div>

              <button 
                disabled={saving} 
                onClick={() => handleSave('general')} 
                className="w-full py-4 font-black bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all disabled:opacity-50 shadow-lg mt-auto"
              >
                {saving ? '⏳ Menyimpan...' : '💾 SIMPAN SETTING UMUM'}
              </button>
            </div>

            {/* Right: Master Switch */}
            <div className="space-y-8 flex flex-col h-full">
              <h3 className="text-xl font-bold text-slate-300 flex items-center gap-2">
                <span className="text-rose-500">🚦</span> Master Switch
              </h3>
              
              <div className="space-y-4 flex-grow">
                {/* BOT SWITCH */}
                <div className={`p-5 rounded-2xl border transition-all duration-300 ${isBotActive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-black text-white text-lg">Private Bot</div>
                      <div className="text-xs text-slate-500">Status taruhan di chat pribadi</div>
                    </div>
                    <button 
                      onClick={() => setIsBotActive(!isBotActive)}
                      className={`w-14 h-7 rounded-full transition-all relative ${isBotActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${isBotActive ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-700/50">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${isBotActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isBotActive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isBotActive ? 'ACTIVE' : 'STOPPED'}
                    </span>
                    <span className="ml-auto text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                       Uptime: {Math.floor(systemInfo.botUptime / 3600)}h {Math.floor((systemInfo.botUptime % 3600) / 60)}m {Math.floor(systemInfo.botUptime % 60)}s
                    </span>
                  </div>
                </div>

                {/* GROUP SWITCH */}
                <div className={`p-5 rounded-2xl border transition-all duration-300 ${isGroupActive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-black text-white text-lg">Group Game</div>
                      <div className="text-xs text-slate-500">Status taruhan di grup publik</div>
                    </div>
                    <button 
                      onClick={() => setIsGroupActive(!isGroupActive)}
                      className={`w-14 h-7 rounded-full transition-all relative ${isGroupActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${isGroupActive ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-700/50">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${isGroupActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isGroupActive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isGroupActive ? 'ACTIVE' : 'STOPPED'}
                    </span>
                    <span className="ml-auto text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                       Uptime: {Math.floor(systemInfo.groupUptime / 3600)}h {Math.floor((systemInfo.groupUptime % 3600) / 60)}m {Math.floor(systemInfo.groupUptime % 60)}s
                    </span>
                  </div>
                </div>
              </div>

              <button 
                disabled={saving} 
                onClick={() => handleSave('bot_status')} 
                className={`w-full py-5 font-black text-white rounded-xl shadow-lg transition-all disabled:opacity-50 mt-auto ${
                  saving ? 'bg-slate-700' : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:shadow-emerald-500/30'
                }`}
              >
                {saving ? '⏳ Menyimpan...' : '💾 UPDATE & RESTART UPTIME'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
