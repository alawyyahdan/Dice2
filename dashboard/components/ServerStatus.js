'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function ServerStatus() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const start = Date.now();
        const data = await api.getMaintenanceStats();
        const end = Date.now();
        
        setLatency(end - start);
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch system stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) return <div className="animate-pulse bg-slate-800/50 h-32 rounded-2xl border border-slate-700 mb-8"></div>;

  const metrics = [
    {
      label: 'CPU CORE LOAD',
      value: `${stats?.cpuUsage || 0}%`,
      sub: stats?.platform ? `${stats.platform} (${stats.arch})` : 'Processor Cluster 01',
      percent: stats?.cpuUsage || 0,
      color: 'bg-rose-500',
      icon: '💻',
      status: 'STABLE'
    },
    {
      label: 'MEMORY ALLOCATION',
      value: `${stats?.ramUsage?.percent || 0}%`,
      sub: `${stats?.ramUsage?.used || 0} GB / ${stats?.ramUsage?.total || 0} GB`,
      percent: stats?.ramUsage?.percent || 0,
      color: 'bg-emerald-500',
      icon: '💾',
      status: 'STABLE'
    },
    {
      label: 'API LATENCY',
      value: `${latency}ms`,
      sub: 'Endpoint Response Time',
      percent: Math.max(100 - (latency / 10), 10),
      color: 'bg-amber-500',
      icon: '⚡',
      status: latency < 100 ? 'STABLE' : 'SLOW'
    },
    {
      label: 'NETWORK UPLINK',
      value: 'SYSTEM',
      sub: stats?.uptime || 'Online',
      percent: 100,
      color: 'bg-cyan-500',
      icon: '📡',
      status: 'ONLINE'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-8">
      {metrics.map((m, idx) => (
        <div key={idx} className="card-dark p-6 relative overflow-hidden group">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{m.label}</p>
              <h3 className="text-3xl font-black text-white">{m.value}</h3>
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/50 group-hover:scale-110 transition-transform">
              <span className="text-xl">{m.icon}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
              <div 
                className={`${m.color} h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                style={{ width: `${m.percent}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-medium text-slate-400 truncate max-w-[70%]">{m.sub}</p>
              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <span className={`w-1 h-1 rounded-full ${m.color} shadow-[0_0_5px_currentColor]`}></span>
                {m.status}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
