'use client';
import Sidebar from '@/components/Sidebar';
import { isAuthenticated } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  if (!mounted) return <div className="min-h-screen bg-slate-900" />;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-slate-100 selection:bg-blue-500/30">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header Jumbo Dark */}
        <header className="md:hidden bg-slate-800 border-b border-slate-700 p-5 flex items-center justify-between z-10 shadow-lg">
          <h1 className="text-2xl font-black text-white">🎲 Dice Admin</h1>
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 lg:p-10 relative z-0">
          <div className="max-w-7xl mx-auto pb-24">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
