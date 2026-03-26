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
  const [formPayment, setFormPayment] = useState({
    providerType: 'sitranfer',
    sitranfer: { merchantId: '', callbackUrl: '', warningText: '', methods: [] },
    manual: { bankName: '', accountNumber: '', accountName: '', logoUrl: '', warningText: '' },
    withdraw: { providerType: 'manual', autoWdLimit: 50, minWithdraw: 20, maxWithdraw: 10000, banks: [] }
  });
  const [systemInfo, setSystemInfo] = useState({ uptime: 0, botUptime: 0, groupUptime: 0 });

  // Security State
  const [adminProfile, setAdminProfile] = useState({ username: '', is2FAEnabled: false });
  const [formSecurity, setFormSecurity] = useState({ username: '', password: '', notificationTelegramId: '' });
  const [qrSetup, setQrSetup] = useState({ secret: '', qrUrl: '' });
  const [otpInput, setOtpInput] = useState('');

  // General Settings State
  const [minBet, setMinBet] = useState(1);
  const [roundDuration, setRoundDuration] = useState(1);
  const [isBotActive, setIsBotActive] = useState(true);
  const [isGroupActive, setIsGroupActive] = useState(true);
  const [isLeaderboardActive, setIsLeaderboardActive] = useState(true);

  // Maintenance State
  const [maintenanceStats, setMaintenanceStats] = useState({ dbUsed: 0, dbMax: 512, cacheSize: 0 });
  const [formForceSub, setFormForceSub] = useState({ isActive: false, channelUsername: '', channelUrl: '' });
  const [resetDbSelection, setResetDbSelection] = useState({
    bets: false,
    deposits: false,
    withdraws: false,
    angpaos: false,
    users: false,
  });

  const handleClearCache = async () => {
    if (!confirm('Yakin ingin membersihkan Cache, Log, dan Temp files?')) return;
    try {
      await api.clearSystemCache();
      alert('✅ Cache, Log, dan Temp files berhasil dibersihkan!');
    } catch (e) {
      alert('❌ Gagal membersihkan cache: ' + e.message);
    }
  };

  const handleResetDb = async () => {
    const selected = Object.keys(resetDbSelection).filter(k => resetDbSelection[k]);
    if (selected.length === 0) return alert('Pilih setidaknya satu data yang ingin direset!');
    
    const warnMsg = `⚠️ PERINGATAN KERAS ⚠️\n\nAnda akan MENGHAPUS SEMUA DATA terpilih.\nTindakan ini PERMANEN dan TIDAK BISA DIBATALKAN!\n\nKetik "RESET" (huruf besar) untuk melanjutkan:`;
    const check = prompt(warnMsg);
    if (check !== 'RESET') return alert('Konfirmasi gagal. Dibatalkan.');

    try {
      const res = await api.resetDatabase({ targets: selected });
      alert('✅ ' + res.message);
      setResetDbSelection({ bets: false, deposits: false, withdraws: false, angpaos: false, users: false });
    } catch (e) {
      alert('❌ Gagal mereset database: ' + e.message);
    }
  };

  const STRING_LABELS = {
    welcomeMessage1: 'Pesan Sambutan 1 (User Baru)',
    welcomeImage1: 'URL Gambar Sambutan 1 (URL)',
    welcomeMessage2: 'Pesan Sambutan 2 (User Baru)',
    welcomeImage2: 'URL Gambar Sambutan 2 (URL)',
    welcome: 'Pesan Selamat Datang (/start)',
    depositInvoiceQR: 'Pesan Tagihan (Jika Scan Gambar QRIS)',
    depositInvoiceLink: 'Pesan Tagihan (Jika Klik Link DANA/BCA)',
    depositInvoiceManual: 'Pesan Tagihan Manual Bank (Detail Rek)',
    depositSuccess: 'Pesan Deposit Sukses / Disetujui',
    depositFailed: 'Pesan Deposit Dibatalkan / Ditolak',
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
    angpao_image: 'URL Gambar Banner Angpao (URL Foto)',
    angpao_claim_success: 'Pop-up klaim Angpao berhasil',
    angpao_habis: 'Pop-up Angpao sudah habis',
    angpao_sudah_klaim: 'Pop-up sudah pernah klaim',
    maintenance_msg: 'Pesan Sedang Maintenance',
    group_link: 'Link Grup Telegram (URL t.me)',
    cs_contact_link: 'Link / Username CS (misal: @AdminCS atau https://t.me/...)',
    forceSub_block: '[Force Sub] Pesan Blokir (saat belum join)',
    forceSub_btn_join: '[Force Sub] Teks Tombol JOIN CHANNEL',
    forceSub_btn_check: '[Force Sub] Teks Tombol SAYA SUDAH JOIN',
    forceSub_success: '[Force Sub] Pesan SUKSES setelah berhasil join',
    forceSub_not_joined_alert: '[Force Sub] Alert Pop-up Belum Join',
  };

  useEffect(() => {
    loadSettings();
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-fetch maintenance stats continuously when that section is open
  useEffect(() => {
    let statInterval;
    if (activeSection === 'maintenance') {
      const fetchStats = () => {
        api.getMaintenanceStats().then(data => setMaintenanceStats(data)).catch(console.error);
      };
      fetchStats();
      statInterval = setInterval(fetchStats, 5000);
    }
    return () => clearInterval(statInterval);
  }, [activeSection]);

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
      setFormPayment(data.paymentGateway || {
        providerType: 'sitranfer',
        sitranfer: { merchantId: '', callbackUrl: '', warningText: '', methods: [] },
        manual: { bankName: '', accountNumber: '', accountName: '', logoUrl: '', warningText: '' },
        withdraw: { providerType: 'manual', autoWdLimit: 50, minWithdraw: 20, maxWithdraw: 10000, banks: [] }
      });
      setMinBet(data.minBet || 1);
      setRoundDuration(data.roundDuration || 1);
      setIsBotActive(data.isBotActive !== false);
      setIsGroupActive(data.isGroupActive !== false);
      setIsLeaderboardActive(data.isLeaderboardActive !== false);
      setFormForceSub(data.forceSub || { isActive: false, channelUsername: '', channelUrl: '' });

      const profile = await api.getAdminProfile();
      setAdminProfile(profile);
      setFormSecurity({ username: profile.username, password: '', notificationTelegramId: profile.notificationTelegramId || '' });
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
      if (sectionKey === 'bot_status') payload = { isBotActive, isGroupActive, isLeaderboardActive, forceSub: formForceSub };
      if (sectionKey === 'payment') payload = { paymentGateway: formPayment };

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

  const handleTestConnection = async () => {
    try {
      const res = await api.testPayment({ paymentGateway: formPayment });
      if (res.success) {
        alert(res.message);
      } else {
        alert('❌ ' + (res.error || 'Gagal tersambung ke SiTranfer.'));
      }
    } catch (e) {
      alert('❌ Error: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      await api.updateAdminProfile({ 
        username: formSecurity.username, 
        password: formSecurity.password || undefined,
        notificationTelegramId: formSecurity.notificationTelegramId
      });
      alert('✅ Profil Admin berhasil diperbarui!');
      setFormSecurity({ ...formSecurity, password: '' });
      loadSettings();
    } catch (e) {
      alert('❌ Gagal update profil: ' + e.message);
    }
    setSaving(false);
  };

  const startSetup2FA = async () => {
    try {
      const { secret, qrCode } = await api.setup2FA();
      setQrSetup({ secret, qrUrl: qrCode });
      setOtpInput('');
    } catch(e) { alert('❌ Gagal generate QR: ' + e.message); }
  };

  const verifySetup2FA = async () => {
    try {
      await api.verify2FA(otpInput);
      alert('✅ 2FA berhasil diaktifkan!');
      setQrSetup({ secret: '', qrUrl: '' });
      setOtpInput('');
      loadSettings();
    } catch(e) { alert('❌ Kode salah / tidak valid: ' + e.message); }
  };

  const disable2FA = async () => {
    const code = prompt('⚠️ Untuk menonaktifkan 2FA, masukkan 6 digit token dari Authenticator App:');
    if (!code) return;
    try {
      await api.disable2FA(code);
      alert('✅ 2FA Dinonaktifkan!');
      loadSettings();
    } catch(e) { alert('❌ Kode salah: ' + e.message); }
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

        <button 
          onClick={() => toggleSection('payment')}
          className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 shadow-xl hover:-translate-y-1 hover:shadow-2xl ${
            activeSection === 'payment' ? 'bg-indigo-600/20 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <span className="text-4xl">💳</span>
          <span className="text-xl font-bold text-white">Payment Gateway</span>
          <span className="text-sm text-slate-400 text-center">Atur Provider Pembayaran & Metode Deposit</span>
          <div className={`mt-2 transition-transform duration-300 ${activeSection==='payment' ? 'rotate-180' : ''}`}>▼</div>
        </button>

        <button 
          onClick={() => toggleSection('withdraw')}
          className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 shadow-xl hover:-translate-y-1 hover:shadow-2xl ${
            activeSection === 'withdraw' ? 'bg-cyan-600/20 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <span className="text-4xl">🏦</span>
          <span className="text-xl font-bold text-white">Sistem Penarikan</span>
          <span className="text-sm text-slate-400 text-center">Auto-WD, Provider, dan Daftar Bank Aktif</span>
          <div className={`mt-2 transition-transform duration-300 ${activeSection==='withdraw' ? 'rotate-180' : ''}`}>▼</div>
        </button>

        <button 
          onClick={() => toggleSection('security')}
          className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 shadow-xl hover:-translate-y-1 hover:shadow-2xl ${
            activeSection === 'security' ? 'bg-amber-600/20 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <span className="text-4xl">🔒</span>
          <span className="text-xl font-bold text-white">Admin Security</span>
          <span className="text-sm text-slate-400 text-center">Update Username, Password & 2FA</span>
          <div className={`mt-2 transition-transform duration-300 ${activeSection==='security' ? 'rotate-180' : ''}`}>▼</div>
        </button>

        <button 
          onClick={() => toggleSection('maintenance')}
          className={`p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-3 shadow-xl hover:-translate-y-1 hover:shadow-2xl ${
            activeSection === 'maintenance' ? 'bg-orange-600/20 border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'bg-slate-800 border-slate-700 hover:border-slate-600'
          }`}
        >
          <span className="text-4xl">🧹</span>
          <span className="text-xl font-bold text-white">System Maintenance</span>
          <span className="text-sm text-slate-400 text-center">Hapus Cache, Log & Reset Database</span>
          <div className={`mt-2 transition-transform duration-300 ${activeSection==='maintenance' ? 'rotate-180' : ''}`}>▼</div>
        </button>
      </div>

      {/* SLIDING POPUPS (Accordion Style) */}
      
      {/* MAINTENANCE POPUP */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeSection === 'maintenance' ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-[#121826] p-6 rounded-xl border border-slate-700 mt-4 shadow-2xl font-sans">
          
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🧹</span>
            <h2 className="text-xl font-bold text-white tracking-wide">System Maintenance</h2>
          </div>
          <hr className="border-slate-800 mb-8" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Clear Cache */}
            <div className="bg-[#161d2d] border border-slate-700 rounded-xl p-6">
               <h3 className="text-lg font-bold text-white mb-2">Clear Cache & Logs</h3>
               <p className="text-sm text-slate-400 mb-6">Bersihkan file sementara, cache query, dan error logs memori untuk melancarkan kinerja bot dan performa dashboard.</p>
               
               <div className="flex items-center justify-between bg-black/30 p-4 rounded-lg border border-slate-800 mb-6 group cursor-default">
                 <div>
                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">NODE.JS MEMORY (RSS)</div>
                    <div className="text-2xl font-black text-white">{maintenanceStats.nodeMem ?? 0} <span className="text-sm text-slate-400 font-bold">MB</span></div>
                 </div>
                 <div className="text-4xl opacity-40 group-hover:opacity-100 transition-opacity">⚡</div>
               </div>

               <button onClick={handleClearCache} className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors border border-slate-600 shadow-md">
                  🧹 BERSIHKAN CACHE SEKARANG
               </button>
            </div>

            {/* Reset Database */}
            <div className="bg-[#1a1515] border border-rose-900/50 rounded-xl p-6">
               <div className="flex justify-between items-start mb-2">
                 <h3 className="text-lg font-bold text-rose-500">Reset Database</h3>
                 <div className="text-right">
                    <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">KAPASITAS MONGODB (${maintenanceStats.dbMax}MB)</div>
                    <div className="text-sm font-bold text-white tracking-wide">{maintenanceStats.dbUsed} <span className="text-rose-500">/</span> {maintenanceStats.dbMax} <span className="text-slate-500 text-xs">MB</span></div>
                 </div>
               </div>

               <div className="w-full bg-[#0b0f19] rounded-full h-2.5 mt-2 mb-6 overflow-hidden border border-slate-800">
                  <div className="bg-gradient-to-r from-rose-500 to-rose-400 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (maintenanceStats.dbUsed / maintenanceStats.dbMax) * 100)}%` }}></div>
               </div>

               <div className="flex flex-col gap-3 mb-6">
                 {[
                   { id: 'bets', label: 'Riwayat Taruhan (Bets)' },
                   { id: 'deposits', label: 'Riwayat Deposit' },
                   { id: 'withdraws', label: 'Riwayat Withdraw' },
                   { id: 'angpaos', label: 'Data Angpao Aktif & Riwayat' },
                   { id: 'users', label: 'Semua Data User (Termasuk Saldo Poin)' },
                 ].map(item => (
                   <label key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${resetDbSelection[item.id] ? 'bg-rose-900/40 border-rose-500' : 'bg-black/20 border-slate-800 hover:border-slate-600'}`}>
                     <input type="checkbox" className="w-5 h-5 accent-rose-500 rounded cursor-pointer" checked={resetDbSelection[item.id]} onChange={(e) => setResetDbSelection({...resetDbSelection, [item.id]: e.target.checked})} />
                     <span className={`font-semibold ${resetDbSelection[item.id] ? 'text-rose-200' : 'text-slate-300'}`}>{item.label}</span>
                   </label>
                 ))}
               </div>

               <button onClick={handleResetDb} className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(225,29,72,0.4)]">
                 ⚠️ RESET DATA TERPILIH
               </button>
            </div>

          </div>
        </div>
      </div>

      {/* 5. PAYMENT GATEWAY POPUP */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeSection === 'payment' ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-[#121826] p-6 rounded-xl border border-slate-700 mt-4 shadow-2xl font-sans">
          
          <div className="flex items-center gap-3 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <h2 className="text-xl font-bold text-white tracking-wide">Payment Gateway Configuration</h2>
          </div>
          <hr className="border-slate-800 mb-8" />
          
          {/* PROVIDER TYPE */}
          <div className="mb-8 p-6 rounded-xl border border-slate-800 bg-[#161d2d]">
             <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 block">SISTEM PEMBAYARAN / DEPOSIT</label>
             <div className="flex flex-wrap gap-4">
               <label className={`flex items-center gap-3 py-3 px-5 rounded-lg border transition-all cursor-pointer ${formPayment.providerType === 'sitranfer' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-transparent hover:border-slate-500'}`}>
                 <input type="radio" name="ptype" className="w-4 h-4 accent-indigo-500" checked={formPayment.providerType === 'sitranfer'} onChange={() => setFormPayment({...formPayment, providerType: 'sitranfer'})}/>
                 <span className="font-semibold text-sm text-slate-200">SiTranfer API (Otomatis)</span>
               </label>
               <label className={`flex items-center gap-3 py-3 px-5 rounded-lg border transition-all cursor-pointer ${formPayment.providerType === 'manual' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-transparent hover:border-slate-500'}`}>
                 <input type="radio" name="ptype" className="w-4 h-4 accent-indigo-500" checked={formPayment.providerType === 'manual'} onChange={() => setFormPayment({...formPayment, providerType: 'manual'})}/>
                 <span className="font-semibold text-sm text-slate-200">Transfer Manual (Bank/E-Wallet)</span>
               </label>
               <label className={`flex items-center gap-3 py-3 px-5 rounded-lg border transition-all cursor-pointer ${formPayment.providerType === 'none' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-transparent hover:border-slate-500'}`}>
                 <input type="radio" name="ptype" className="w-4 h-4 accent-indigo-500" checked={formPayment.providerType === 'none'} onChange={() => setFormPayment({...formPayment, providerType: 'none'})}/>
                 <span className="font-semibold text-sm text-slate-200">Matikan Deposit</span>
               </label>
             </div>
          </div>

          {/* DEPOSIT LIMITS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-6 rounded-xl border border-slate-800 bg-[#161d2d]">
            <div>
              <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 block">MINIMAL DEPOSIT</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                <input 
                  type="number" 
                  className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg pl-12 pr-4 py-3 text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-slate-600 cursor-text"
                  value={formPayment.minDeposit ?? 10000}
                  onChange={(e) => setFormPayment({...formPayment, minDeposit: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 block">MAKSIMAL DEPOSIT</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                <input 
                  type="number" 
                  className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg pl-12 pr-4 py-3 text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-slate-600 cursor-text"
                  value={formPayment.maxDeposit ?? 50000000}
                  onChange={(e) => setFormPayment({...formPayment, maxDeposit: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>

          {/* SITRANFER CONFIG */}
          {formPayment.providerType === 'sitranfer' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-4 mt-6">
                <h3 className="text-lg font-bold text-white">Kredensial SiTranfer</h3>
                <button 
                  onClick={handleTestConnection}
                  className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors flex items-center gap-2">
                  <span>💲</span> Tes Koneksi & Cek Saldo
                </button>
              </div>
              <hr className="border-slate-800 mb-6" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 block">MERCHANT ID / STORE KEY</label>
                  <input 
                    type="password" 
                    value={formPayment.sitranfer.merchantId || ''}
                    onChange={(e) => setFormPayment({...formPayment, sitranfer: {...formPayment.sitranfer, merchantId: e.target.value}})}
                    className="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-3 text-slate-300 font-mono text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 block">CALLBACK URL WEBHOOK (SALIN KE PROVIDER)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      readOnly
                      value={typeof window !== 'undefined' ? `${window.location.origin.replace('3000', '3001')}/api/deposit/callback` : ''}
                      title="Klik ikon copy"
                      className="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-3 pr-12 text-slate-400 font-mono text-xs outline-none cursor-default"
                    />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        const url = typeof window !== 'undefined' ? `${window.location.origin.replace('3000', '3001')}/api/deposit/callback` : '';
                        navigator.clipboard.writeText(url);
                        alert('✅ URL Webhook berhasil disalin! Silakan paste di dashboard SiTranfer.');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-md transition-colors"
                      title="Salin URL"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 block">TEKS PERINGATAN / INSTRUKSI (BAWAH FORM DEPOSIT MINIAPP)</label>
                  <input 
                    type="text"
                    value={formPayment.sitranfer.warningText || ''}
                    onChange={(e) => setFormPayment({...formPayment, sitranfer: {...formPayment.sitranfer, warningText: e.target.value}})}
                    className="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-3 text-slate-300 text-sm focus:border-indigo-500 outline-none"
                    placeholder="⚠️ Silakan bayar sesuai nominal untuk mempercepat otomatisasi deposit Anda."
                  />
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mt-10 mb-4">Metode Deposit Aktif</h3>
              <hr className="border-slate-800 mb-6" />
              
              <div className="space-y-4">
                {formPayment.sitranfer.methods && formPayment.sitranfer.methods.map((method, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-center gap-4 bg-[#161d2d] p-5 rounded-xl border border-slate-800 relative group">
                    <button 
                        onClick={() => {
                          const newMethods = formPayment.sitranfer.methods.filter((_, i) => i !== idx);
                          setFormPayment({ ...formPayment, sitranfer: {...formPayment.sitranfer, methods: newMethods} });
                        }}
                        className="absolute right-3 top-3 p-1.5 text-slate-500 border border-slate-700 rounded-md hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                        title="Hapus Metode"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>

                    <div className="flex-1 w-full mt-2 md:mt-0">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">KODE PROVIDER (SITRANFER CHANNEL)</label>
                      <input 
                        type="text" 
                        value={method.code || ''}
                        onChange={(e) => {
                          const newMethods = [...formPayment.sitranfer.methods];
                          newMethods[idx].code = e.target.value;
                          setFormPayment({ ...formPayment, sitranfer: {...formPayment.sitranfer, methods: newMethods} });
                        }}
                        className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2.5 px-3 text-slate-200 font-bold text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">NAMA METODE (MINIAPP)</label>
                      <input 
                        type="text" 
                        value={method.name || ''}
                        onChange={(e) => {
                          const newMethods = [...formPayment.sitranfer.methods];
                          newMethods[idx].name = e.target.value;
                          setFormPayment({ ...formPayment, sitranfer: {...formPayment.sitranfer, methods: newMethods} });
                        }}
                        className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2.5 px-3 text-slate-200 font-bold text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">URL LOGO / ICON</label>
                      <input 
                        type="text" 
                        value={method.logoUrl || ''}
                        onChange={(e) => {
                          const newMethods = [...formPayment.sitranfer.methods];
                          newMethods[idx].logoUrl = e.target.value;
                          setFormPayment({ ...formPayment, sitranfer: {...formPayment.sitranfer, methods: newMethods} });
                        }}
                        className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2.5 px-3 text-slate-400 font-mono text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex flex-col mb-1 w-full md:w-24 mt-2 md:mt-0 pt-0">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block text-center md:text-left">STATUS</label>
                      <button 
                        onClick={() => {
                          const newMethods = [...formPayment.sitranfer.methods];
                          newMethods[idx].isActive = !newMethods[idx].isActive;
                          setFormPayment({ ...formPayment, sitranfer: {...formPayment.sitranfer, methods: newMethods} });
                        }}
                        className={`w-full py-2.5 rounded-md font-bold text-xs transition-colors border ${method.isActive ? 'bg-[#0f291e] text-[#10b981] border-[#10b981]/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                      >
                        {method.isActive ? 'BISA' : 'MATI'}
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={() => {
                    setFormPayment({
                      ...formPayment, 
                      sitranfer: {...formPayment.sitranfer, methods: [...(formPayment.sitranfer.methods || []), { code: '', name: '', logoUrl: '', isActive: true }]}
                    });
                  }}
                  className="w-full py-4 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all text-xs font-bold mt-2 bg-transparent uppercase tracking-wider h-14"
                >
                  + TAMBAH METODE BARU
                </button>
              </div>
            </div>
          )}

          {/* MANUAL CONFIG */}
          {formPayment.providerType === 'manual' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 mt-6">
              
              <div className="mb-6">
                <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 block">TEKS PERINGATAN / INSTRUKSI (BAWAH FORM DEPOSIT MINIAPP)</label>
                <input 
                  type="text"
                  value={formPayment.manual.warningText || ''}
                  onChange={(e) => setFormPayment({...formPayment, manual: {...formPayment.manual, warningText: e.target.value}})}
                  className="w-full bg-[#0d1117] border border-slate-700 rounded-lg p-3 text-slate-300 text-sm focus:border-indigo-500 outline-none"
                  placeholder="⚠️ Harap transfer dana lalu tunggu admin memvalidasi deposit..."
                />
              </div>

              <h3 className="text-lg font-bold text-white mt-10 mb-4">Rekening Bank / E-Wallet Manual</h3>
              <hr className="border-slate-800 mb-6" />
              
              <div className="space-y-4">
                {formPayment.manual.methods && formPayment.manual.methods.map((method, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-center gap-4 bg-[#161d2d] p-5 rounded-xl border border-slate-800 relative group">
                    <button 
                        onClick={() => {
                          const newMethods = formPayment.manual.methods.filter((_, i) => i !== idx);
                          setFormPayment({ ...formPayment, manual: {...formPayment.manual, methods: newMethods} });
                        }}
                        className="absolute right-3 top-3 p-1.5 text-slate-500 border border-slate-700 rounded-md hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                        title="Hapus Metode"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>

                    <div className="flex-1 w-full mt-2 md:mt-0">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">NAMA BANK</label>
                      <input 
                        type="text" 
                        value={method.bankName || ''}
                        onChange={(e) => {
                          const newMethods = [...formPayment.manual.methods];
                          newMethods[idx].bankName = e.target.value;
                          setFormPayment({ ...formPayment, manual: {...formPayment.manual, methods: newMethods} });
                        }}
                        className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2.5 px-3 text-slate-200 font-bold text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">NOMOR REKENING / HP</label>
                      <input 
                        type="text" 
                        value={method.accountNumber || ''}
                        onChange={(e) => {
                          const newMethods = [...formPayment.manual.methods];
                          newMethods[idx].accountNumber = e.target.value;
                          setFormPayment({ ...formPayment, manual: {...formPayment.manual, methods: newMethods} });
                        }}
                        className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2.5 px-3 text-slate-200 font-bold text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">ATAS NAMA (A/N)</label>
                      <input 
                        type="text" 
                        value={method.accountName || ''}
                        onChange={(e) => {
                          const newMethods = [...formPayment.manual.methods];
                          newMethods[idx].accountName = e.target.value;
                          setFormPayment({ ...formPayment, manual: {...formPayment.manual, methods: newMethods} });
                        }}
                        className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2.5 px-3 text-slate-200 font-bold text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">URL LOGO / ICON</label>
                      <input 
                        type="text" 
                        value={method.logoUrl || ''}
                        onChange={(e) => {
                          const newMethods = [...formPayment.manual.methods];
                          newMethods[idx].logoUrl = e.target.value;
                          setFormPayment({ ...formPayment, manual: {...formPayment.manual, methods: newMethods} });
                        }}
                        className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2.5 px-3 text-slate-400 font-mono text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex flex-col mb-1 w-full md:w-24 mt-2 md:mt-0 pt-0">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block text-center md:text-left">STATUS</label>
                      <button 
                        onClick={() => {
                          const newMethods = [...formPayment.manual.methods];
                          newMethods[idx].isActive = !newMethods[idx].isActive;
                          setFormPayment({ ...formPayment, manual: {...formPayment.manual, methods: newMethods} });
                        }}
                        className={`w-full py-2.5 rounded-md font-bold text-xs transition-colors border ${method.isActive ? 'bg-[#0f291e] text-[#10b981] border-[#10b981]/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                      >
                        {method.isActive ? 'BISA' : 'MATI'}
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={() => {
                    const existing = Array.isArray(formPayment.manual.methods) ? formPayment.manual.methods : [];
                    setFormPayment({
                      ...formPayment, 
                      manual: {...formPayment.manual, methods: [...existing, { code: '', bankName: '', accountNumber: '', accountName: '', logoUrl: '', isActive: true }]}
                    });
                  }}
                  className="w-full py-4 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all text-xs font-bold mt-2 bg-transparent uppercase tracking-wider h-14"
                >
                  + TAMBAH BANK MANUAL
                </button>
              </div>

            </div>
          )}

          {/* NONE CONFIG */}
          {formPayment.providerType === 'none' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-10 mt-6">
               <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-600 mb-4 opacity-70"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="9" y2="15"/><line x1="15" x2="9" y1="9" y2="15"/></svg>
               <h3 className="text-xl font-bold text-slate-300">Deposit Dimatikan</h3>
            </div>
          )}

          {/* PROMOSI DEPOSIT */}
          <div className="animate-in fade-in duration-300 mt-10">
            <h3 className="text-lg font-bold text-white mb-4">Daftar Promo Deposit Aktif</h3>
            <p className="text-xs text-slate-400 mb-6">User dapat memilih promo bonus ini saat form checkout deposit di MiniApp. (Nilai turnover = (Deposit + Bonus) * Syarat TO).</p>
            <hr className="border-slate-800 mb-6" />
            
            <div className="space-y-4">
              {(formPayment.depositPromos || []).map((promo, idx) => (
                <div key={idx} className="flex flex-col md:flex-row flex-wrap items-center gap-4 bg-[#161d2d] p-5 rounded-xl border border-slate-800 relative group">
                  <button 
                      onClick={() => {
                        const newPromos = formPayment.depositPromos.filter((_, i) => i !== idx);
                        setFormPayment({ ...formPayment, depositPromos: newPromos });
                      }}
                      className="absolute right-3 top-3 p-1.5 text-slate-500 border border-slate-700 rounded-md hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                      title="Hapus Promo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>

                  <div className="flex-1 w-full min-w-[150px] mt-2 md:mt-0">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">NAMA PROMO</label>
                    <input 
                      type="text" 
                      value={promo.name || ''}
                      onChange={(e) => {
                        const newPromos = [...(formPayment.depositPromos || [])];
                        newPromos[idx].name = e.target.value;
                        setFormPayment({ ...formPayment, depositPromos: newPromos });
                      }}
                      className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2 px-3 text-slate-200 font-bold text-sm outline-none"
                    />
                  </div>
                  <div className="w-full md:w-32">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">TIPE BONUS</label>
                    <select 
                      value={promo.type || 'percent'}
                      onChange={(e) => {
                        const newPromos = [...(formPayment.depositPromos || [])];
                        newPromos[idx].type = e.target.value;
                        setFormPayment({ ...formPayment, depositPromos: newPromos });
                      }}
                      className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2 px-3 text-slate-200 text-sm outline-none"
                    >
                      <option value="percent">Persen (%)</option>
                      <option value="fixed">Fix (Poin)</option>
                    </select>
                  </div>
                  <div className="w-full md:w-32">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">NILAI BONUS</label>
                    <input 
                      type="number" 
                      value={promo.bonusValue || 0}
                      onChange={(e) => {
                        const newPromos = [...(formPayment.depositPromos || [])];
                        newPromos[idx].bonusValue = parseFloat(e.target.value) || 0;
                        setFormPayment({ ...formPayment, depositPromos: newPromos });
                      }}
                      className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2 px-3 text-emerald-400 font-bold text-sm outline-none"
                    />
                  </div>
                  <div className="w-full md:w-32">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">SYARAT TURN OVER</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={promo.turnoverMultiplier || 0}
                      onChange={(e) => {
                        const newPromos = [...(formPayment.depositPromos || [])];
                        newPromos[idx].turnoverMultiplier = parseFloat(e.target.value) || 0;
                        setFormPayment({ ...formPayment, depositPromos: newPromos });
                      }}
                      className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2 px-3 text-amber-400 font-bold text-sm outline-none"
                      placeholder="e.g. 1.0, 3.5, 5.0"
                    />
                  </div>
                  <div className="flex flex-col w-full md:w-24 mt-2 md:mt-0 pt-0">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block text-center md:text-left">STATUS</label>
                    <button 
                      onClick={() => {
                        const newPromos = [...(formPayment.depositPromos || [])];
                        newPromos[idx].isActive = !newPromos[idx].isActive;
                        setFormPayment({ ...formPayment, depositPromos: newPromos });
                      }}
                      className={`w-full py-2 rounded-md font-bold text-xs transition-colors border ${promo.isActive ? 'bg-[#0f291e] text-[#10b981] border-[#10b981]/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                    >
                      {promo.isActive ? 'AKTIF' : 'MATI'}
                    </button>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={() => {
                  const existing = Array.isArray(formPayment.depositPromos) ? formPayment.depositPromos : [];
                  setFormPayment({
                    ...formPayment, 
                    depositPromos: [...existing, { id: `PRM-${Date.now()}`, name: '', type: 'percent', bonusValue: 10, turnoverMultiplier: 1, isActive: true }]
                  });
                }}
                className="w-full py-4 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all text-sm font-bold mt-2 bg-transparent uppercase tracking-wider"
              >
                + BIKIN PROMO DEPOSIT BARU
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
            <button disabled={saving} onClick={() => handleSave('payment')} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
              {saving ? '⏳ Menyimpan...' : 'Simpan Konfigurasi'}
            </button>
          </div>
        </div>
      </div>

      {/* WITHDRAW POPUP */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeSection === 'withdraw' ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-[#121826] p-6 rounded-xl border border-slate-700 mt-4 shadow-2xl font-sans">
          
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-bold text-white tracking-wide">Withdraw Configuration (Sistem Penarikan)</h2>
          </div>
          <hr className="border-slate-800 mb-8" />
          
          {/* PROVIDER TYPE */}
          <div className="mb-8 p-6 rounded-xl border border-slate-800 bg-[#161d2d]">
             <label className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4 block">SISTEM PENARIKAN (WITHDRAW)</label>
             <div className="flex flex-wrap gap-4">
               <label className={`flex items-center gap-3 py-3 px-5 rounded-lg border transition-all cursor-pointer ${formPayment.withdraw?.providerType === 'sitranfer' ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-transparent hover:border-slate-500'}`}>
                 <input type="radio" className="w-4 h-4 accent-cyan-500" checked={formPayment.withdraw?.providerType === 'sitranfer'} onChange={() => setFormPayment({...formPayment, withdraw: {...(formPayment.withdraw||{}), providerType: 'sitranfer'}})}/>
                 <span className="font-semibold text-sm text-slate-200">SiTranfer API (Auto-WD)</span>
               </label>
               <label className={`flex items-center gap-3 py-3 px-5 rounded-lg border transition-all cursor-pointer ${formPayment.withdraw?.providerType === 'manual' ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-transparent hover:border-slate-500'}`}>
                 <input type="radio" className="w-4 h-4 accent-cyan-500" checked={formPayment.withdraw?.providerType === 'manual'} onChange={() => setFormPayment({...formPayment, withdraw: {...(formPayment.withdraw||{}), providerType: 'manual'}})}/>
                 <span className="font-semibold text-sm text-slate-200">Transfer Manual</span>
               </label>
               <label className={`flex items-center gap-3 py-3 px-5 rounded-lg border transition-all cursor-pointer ${formPayment.withdraw?.providerType === 'none' ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-transparent hover:border-slate-500'}`}>
                 <input type="radio" className="w-4 h-4 accent-cyan-500" checked={formPayment.withdraw?.providerType === 'none'} onChange={() => setFormPayment({...formPayment, withdraw: {...(formPayment.withdraw||{}), providerType: 'none'}})}/>
                 <span className="font-semibold text-sm text-slate-200">Matikan Withdraw</span>
               </label>
              </div>
           </div>

           <div className="mb-8 p-6 rounded-xl border border-slate-800 bg-[#161d2d]">
              <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-2 block">ATURAN PENARIKAN (RULE)</label>
              <select 
                value={formPayment.withdraw?.rule || 'free'} 
                onChange={e => setFormPayment({...formPayment, withdraw: {...(formPayment.withdraw||{}), rule: e.target.value}})}
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg py-3 px-4 text-white focus:border-cyan-500 outline-none"
              >
                <option value="free">Bebas Menarik Nominal Berapapun (Minimal diatas batas minimal WD)</option>
                <option value="all">Wajib Tarik Semua Saldo Poin Sekaligus Secara Otomatis</option>
              </select>
           </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-6 rounded-xl border border-slate-800 bg-[#161d2d]">
            <div>
              <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-2 block">LIMIT AUTO-WD (POIN)</label>
              <div className="relative">
                <input 
                  type="number" 
                  className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg pr-4 pl-4 py-3 text-white font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  value={formPayment.withdraw?.autoWdLimit ?? 50}
                  onChange={(e) => setFormPayment({...formPayment, withdraw: {...(formPayment.withdraw||{}), autoWdLimit: parseInt(e.target.value) || 0}})}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Nominal di bawah limit akan langsung ditransfer otomatis oleh SiTranfer.</p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-2 block">MIN WD (POIN)</label>
              <div className="relative">
                <input 
                  type="number" 
                  className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg pr-4 pl-4 py-3 text-white font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  value={formPayment.withdraw?.minWithdraw ?? 50}
                  onChange={(e) => setFormPayment({...formPayment, withdraw: {...(formPayment.withdraw||{}), minWithdraw: parseInt(e.target.value) || 0}})}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-2 block">MAX WD (POIN)</label>
              <div className="relative">
                <input 
                  type="number" 
                  className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg pr-4 pl-4 py-3 text-white font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  value={formPayment.withdraw?.maxWithdraw ?? 10000}
                  onChange={(e) => setFormPayment({...formPayment, withdraw: {...(formPayment.withdraw||{}), maxWithdraw: parseInt(e.target.value) || 0}})}
                />
              </div>
            </div>
          </div>

          {formPayment.withdraw?.providerType !== 'none' && (
            <div className="animate-in fade-in duration-300">
              <h3 className="text-lg font-bold text-white mt-10 mb-4">Daftar Bank / E-Wallet yang Didukung</h3>
              <hr className="border-slate-800 mb-6" />
              
              <div className="space-y-4">
                {(formPayment.withdraw?.banks || []).map((method, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-center gap-4 bg-[#161d2d] p-5 rounded-xl border border-slate-800 relative group">
                    <button 
                        onClick={() => {
                          const newMethods = formPayment.withdraw.banks.filter((_, i) => i !== idx);
                          setFormPayment({ ...formPayment, withdraw: {...formPayment.withdraw, banks: newMethods} });
                        }}
                        className="absolute right-3 top-3 p-1.5 text-slate-500 border border-slate-700 rounded-md hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                        title="Hapus Bank"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>

                    <div className="flex-1 w-full mt-2 md:mt-0">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">KODE BANK (SITRANFER CODE)</label>
                      <input 
                        type="text" 
                        value={method.code || ''}
                        onChange={(e) => {
                          const newMethods = [...formPayment.withdraw.banks];
                          newMethods[idx].code = e.target.value;
                          setFormPayment({ ...formPayment, withdraw: {...formPayment.withdraw, banks: newMethods} });
                        }}
                        className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2.5 px-3 text-slate-200 font-bold text-sm focus:border-cyan-500 outline-none"
                        placeholder="Cth: BCA"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">NAMA TAMPILAN (MINIAPP)</label>
                      <input 
                        type="text" 
                        value={method.name || ''}
                        onChange={(e) => {
                          const newMethods = [...formPayment.withdraw.banks];
                          newMethods[idx].name = e.target.value;
                          setFormPayment({ ...formPayment, withdraw: {...formPayment.withdraw, banks: newMethods} });
                        }}
                        className="w-full bg-[#0d1117] border border-slate-700 rounded-md py-2.5 px-3 text-slate-200 font-bold text-sm focus:border-cyan-500 outline-none"
                        placeholder="Cth: Bank BCA"
                      />
                    </div>
                    
                    <div className="flex flex-col mb-1 w-full md:w-24 mt-2 md:mt-0 pt-0">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block text-center md:text-left">STATUS</label>
                      <button 
                        onClick={() => {
                          const newMethods = [...formPayment.withdraw.banks];
                          newMethods[idx].isActive = !newMethods[idx].isActive;
                          setFormPayment({ ...formPayment, withdraw: {...formPayment.withdraw, banks: newMethods} });
                        }}
                        className={`w-full py-2.5 rounded-md font-bold text-xs transition-colors border ${method.isActive ? 'bg-[#0f291e] text-[#10b981] border-[#10b981]/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                      >
                        {method.isActive ? 'BISA' : 'MATI'}
                      </button>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={() => {
                    const existing = Array.isArray(formPayment.withdraw?.banks) ? formPayment.withdraw.banks : [];
                    setFormPayment({
                      ...formPayment, 
                      withdraw: {...(formPayment.withdraw||{}), banks: [...existing, { code: '', name: '', isActive: true }]}
                    });
                  }}
                  className="w-full py-4 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all text-xs font-bold mt-2 bg-transparent uppercase tracking-wider h-14"
                >
                  + TAMBAH BANK BARU
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
            <button disabled={saving} onClick={() => handleSave('payment')} className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
              {saving ? '⏳ Menyimpan...' : 'Simpan Sistem Penarikan'}
            </button>
          </div>
        </div>
      </div>

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

                {/* LEADERBOARD SWITCH */}
                <div className={`p-5 rounded-2xl border transition-all duration-300 ${isLeaderboardActive ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-700/20 border-slate-700/50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-black text-white text-lg">Leaderboard Global</div>
                      <div className="text-xs text-slate-500">Tampilkan / Sembunyikan daftar juara di MiniApp</div>
                    </div>
                    <button 
                      onClick={() => setIsLeaderboardActive(!isLeaderboardActive)}
                      className={`w-14 h-7 rounded-full transition-all relative ${isLeaderboardActive ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${isLeaderboardActive ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                {/* FORCE SUB SWITCH */}
                <div className={`p-5 rounded-2xl border transition-all duration-300 ${formForceSub.isActive ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-slate-700/20 border-slate-700/50'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-black text-white text-lg">Force Sub Channel</div>
                      <div className="text-xs text-slate-500">Wajibkan user join channel tele</div>
                    </div>
                    <button 
                      onClick={() => setFormForceSub({...formForceSub, isActive: !formForceSub.isActive})}
                      className={`w-14 h-7 rounded-full transition-all relative ${formForceSub.isActive ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${formForceSub.isActive ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                  
                  {formForceSub.isActive && (
                    <div className="mt-4 space-y-3 pt-3 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-2">
                      <div>
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5 block">Username Channel (Bot harus Admin)</label>
                        <input 
                          type="text" 
                          value={formForceSub.channelUsername}
                          onChange={(e) => setFormForceSub({...formForceSub, channelUsername: e.target.value})}
                          placeholder="@NamaChannel"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5 block">Link Invite Channel</label>
                        <input 
                          type="text" 
                          value={formForceSub.channelUrl}
                          onChange={(e) => setFormForceSub({...formForceSub, channelUrl: e.target.value})}
                          placeholder="https://t.me/NamaChannel"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}
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
      
      {/* 6. SECURITY POPUP */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${activeSection === 'security' ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="card-dark p-8 md:p-10 border-2 border-amber-500/50 shadow-[0_10px_40px_rgba(245,158,11,0.15)] mt-4">
          <h2 className="text-3xl font-black text-white mb-8 border-b border-slate-700 pb-5">
             🔒 Keamanan Admin
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            
            {/* Ganti Profil */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-300">Ubah Kredensial Login</h3>
              <div>
                <label className="text-xs font-black text-amber-500/80 uppercase tracking-widest block mb-2">Username Administrator</label>
                <input 
                  type="text" 
                  value={formSecurity.username}
                  onChange={(e) => setFormSecurity({...formSecurity, username: e.target.value})}
                  className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl py-3 px-4 text-white font-mono outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-black text-amber-500/80 uppercase tracking-widest block mb-2">Password Baru (Kosongkan bila tidak diubah)</label>
                <input 
                  type="password"
                  placeholder="********"
                  value={formSecurity.password}
                  onChange={(e) => setFormSecurity({...formSecurity, password: e.target.value})}
                  className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl py-3 px-4 text-white font-mono outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-black text-amber-500/80 uppercase tracking-widest block mb-2">ID Telegram Admin (Notifikasi Depo/WD Manual)</label>
                <input 
                  type="text"
                  placeholder="Isi Telegram ID (Angka)"
                  value={formSecurity.notificationTelegramId}
                  onChange={(e) => setFormSecurity({...formSecurity, notificationTelegramId: e.target.value})}
                  className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl py-3 px-4 text-white font-mono outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  *Bot akan mengirim pesan pemberitahuan otomatis ke ID ini saat ada formulir Deposit & Withdraw Manual baru dari user.
                </p>
              </div>
              <button 
                onClick={handleUpdateProfile} 
                disabled={saving}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? '⏳ Memproses...' : '💾 SIMPAN KREDENSIAL'}
              </button>
            </div>

            {/* 2FA SETUP */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-300">Two-Factor Authentication (2FA)</h3>
              
              {!adminProfile.is2FAEnabled && !qrSetup.qrUrl && (
                <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-3xl">🛡️</div>
                  <p className="text-slate-400 text-sm">Tingkatkan keamanan login admin Anda menggunakan Google Authenticator atau Authy.</p>
                  <button onClick={startSetup2FA} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white transition-colors">
                    Setup 2FA Sekarang
                  </button>
                </div>
              )}

              {!adminProfile.is2FAEnabled && qrSetup.qrUrl && (
                <div className="p-6 bg-slate-900 border-2 border-indigo-500/30 rounded-2xl flex flex-col items-center gap-6">
                  <p className="text-slate-300 text-center font-bold">1. Scan QR Code ini dengan Google Authenticator</p>
                  <img src={qrSetup.qrUrl} alt="2FA QR Code" className="w-48 h-48 bg-white p-2 rounded-xl" />
                  <div className="flex flex-col w-full gap-2 text-center">
                     <span className="text-xs text-slate-500">Atau masukkan secret key secara manual:</span>
                     <code className="text-indigo-400 bg-black/50 py-2 rounded-lg text-sm select-all tracking-widest">{qrSetup.secret}</code>
                  </div>
                  <hr className="w-full border-slate-700" />
                  <p className="text-slate-300 text-center font-bold">2. Masukkan 6 Digit Kode Token Verifikasi</p>
                  <input 
                    type="text" 
                    maxLength={6}
                    placeholder="123456"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl py-3 px-4 text-white text-center font-mono text-2xl tracking-[0.5em] focus:border-indigo-500 outline-none transition-colors"
                  />
                  <div className="flex gap-4 w-full">
                     <button onClick={() => setQrSetup({ secret: '', qrUrl: '' })} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-white transition-colors">Batal</button>
                     <button onClick={verifySetup2FA} disabled={otpInput.length !== 6} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-white transition-colors disabled:opacity-50">Validasi & Aktifkan</button>
                  </div>
                </div>
              )}

              {adminProfile.is2FAEnabled && (
                <div className="p-6 bg-emerald-900/10 border-2 border-emerald-500/30 rounded-2xl flex flex-col items-center text-center gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(16,185,129,0.2)]">🛡️</div>
                  <div>
                    <h4 className="text-emerald-400 font-black text-xl mb-1">2FA AKTIF PROTECTED</h4>
                    <p className="text-slate-400 text-sm px-4">Akun administrator ini dilindungi dari akses ilegal melalui 2-Step Verification.</p>
                  </div>
                  <button onClick={disable2FA} className="mt-4 px-6 py-3 border-2 border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-bold transition-all">
                    🚫 Nonaktifkan 2FA
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
