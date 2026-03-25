'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '@/lib/auth';

const navItems = [
  { href: '/dashboard', label: '📊 Overview' },
  { href: '/dashboard/analytics', label: '📈 Analytics & PnL' },
  { href: '/dashboard/leaderboard', label: '🏆 Leaderboard' },
  { href: '/dashboard/users', label: '👥 Data Users' },
  { href: '/dashboard/bets', label: '🎲 Histori Taruhan' },
  { href: '/dashboard/deposit', label: '📥 Data Deposit' },
  { href: '/dashboard/withdraw', label: '💸 Withdraw' },
  { href: '/dashboard/angpao', label: '🧧 Histori Angpao' },
  { href: '/dashboard/groups', label: '🏢 Manajemen Grup' },
  { href: '/dashboard/promosi', label: '📢 Manajemen Promosi' },
  { href: '/dashboard/settings', label: '⚙️ Pengaturan Game' },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.push('/login');
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-700 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}>
        <div className="p-8 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              🎲 DICE<span className="text-blue-500">APP</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-bold">Admin Panel</p>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-white p-2 rounded-xl bg-slate-800 hover:bg-rose-500 transition-colors font-bold text-xl">
            ✕
          </button>
        </div>
        
        <nav className="flex-1 p-5 overflow-y-auto space-y-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center px-5 py-4 rounded-2xl text-[17px] font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)]'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 text-center">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-5 py-4 text-base font-black text-white bg-rose-600 hover:bg-rose-700 rounded-2xl transition-all shadow-[0_4px_15px_rgba(225,29,72,0.3)]"
          >
            <span>🚪</span> LOGOUT
          </button>
        </div>
      </aside>
    </>
  );
}
