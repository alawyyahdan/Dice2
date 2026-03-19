export default function DataTable({ columns, data, loading }) {
  if (loading) {
    return <div className="text-center py-16 text-slate-500 font-bold text-xl animate-pulse">Memuat data...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="card-dark text-center py-24 text-slate-400 font-bold text-lg tracking-wide">Tidak ada data ditemukan.</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-xl w-full">
      <div className="overflow-x-auto w-full">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900/50 text-left">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-4 text-xs lg:text-[13px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700 bg-slate-800">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-700/50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-4 text-sm lg:text-[15px] text-slate-200 font-medium whitespace-nowrap">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
