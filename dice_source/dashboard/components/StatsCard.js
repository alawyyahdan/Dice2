export default function StatsCard({ title, value, sub, color = 'blue', icon }) {
  const colorMap = {
    blue: 'text-blue-400 bg-blue-500/10 border border-blue-500/20',
    green: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
    yellow: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
    red: 'text-rose-400 bg-rose-500/10 border border-rose-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border border-purple-500/20',
  };

  return (
    <div className="card-dark p-6 transition-transform duration-200 hover:-translate-y-1">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-4 rounded-2xl ${colorMap[color]}`}>
          <span className="text-3xl block leading-none">{icon}</span>
        </div>
        {sub && <span className="text-xs font-bold px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg border border-slate-600">{sub}</span>}
      </div>
      <div>
        <div className="text-4xl font-black text-white tracking-tight">{value}</div>
        <div className="text-base font-semibold mt-2 text-slate-400 uppercase tracking-widest">{title}</div>
      </div>
    </div>
  );
}
