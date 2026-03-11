export default function KpiCard({ label, value, sub, alert, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {alert && (
        <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {alert}
        </div>
      )}
    </div>
  )
}
