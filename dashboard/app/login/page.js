'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setToken } from '@/lib/auth';

function Toast({ message, onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-rose-500 text-white font-bold px-6 py-3 rounded-xl shadow-[0_10px_40px_rgba(244,63,94,0.4)] flex items-center gap-3">
        <span className="text-xl">⚠️</span> {message}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [tokenInput, setTokenInput] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.login(form.username, form.password, show2FA ? tokenInput : undefined);
      if (data.requires2FA) {
         setShow2FA(true);
      } else if (data.token) {
         setToken(data.token);
         router.push('/dashboard');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Login gagal.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      <Toast message={errorMsg} onClose={() => setErrorMsg('')} />

      <div className="bg-[#121826]/80 backdrop-blur-xl border border-slate-800 rounded-[2rem] shadow-2xl w-full max-w-[420px] p-10 relative z-10 transition-all duration-500">
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6 transform -rotate-6 hover:rotate-0 transition-all duration-300">
             <span className="text-4xl text-white">🎲</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Dice Admin</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">Masuk ke ruang kontrol permainan</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!show2FA ? (
            <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full bg-[#0d1117] border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-white font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-600"
                  placeholder="Username"
                  required
                />
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-[#0d1117] border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-white font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-600"
                  placeholder="Password"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500 text-center">
              <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center text-3xl mb-4 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">🛡️</div>
              <h2 className="text-white font-bold text-lg">Two-Factor Authentication</h2>
              <p className="text-slate-400 text-sm px-2">Akun Anda dilindungi 2FA. Silakan buka aplikasi Authenticator Anda.</p>
              <input
                type="text"
                maxLength={6}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full bg-[#0d1117] border-2 border-slate-700 rounded-xl py-4 text-white font-mono text-2xl tracking-[0.5em] focus:outline-none focus:border-indigo-500 text-center transition-all placeholder-slate-700"
                placeholder="000000"
                required
                autoFocus
              />
              <button type="button" onClick={() => {setShow2FA(false); setTokenInput('');}} className="text-slate-500 hover:text-white text-xs underline mt-2 transition-colors">Kembali ke Login</button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (show2FA && tokenInput.length !== 6)}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-600/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mt-4 transform active:scale-[0.98]"
          >
            {loading ? '⏳ Memvalidasi...' : show2FA ? 'Verifikasi & Masuk' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
