import Card from '../ui/Card'
import Badge from '../ui/Badge'

export default function DailyStoreReport({ data }) {
  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const statusMap = {
    APPROVED: { variant: 'success', label: 'Approved' },
    SUBMITTED: { variant: 'info', label: 'Submitted' },
    DRAFT: { variant: 'warning', label: 'Draft' },
    REJECTED: { variant: 'danger', label: 'Rejected' },
    NOT_STARTED: { variant: 'neutral', label: 'Not Started' },
  }

  if (!data) return null
  const { closing, sales, date } = data

  const dateStr = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', weekday: 'short',
  })

  const st = statusMap[closing.status] || statusMap.NOT_STARTED
  const variance = parseFloat(closing.variance || 0)
  const varianceAbs = Math.abs(variance)

  return (
    <Card className="p-5 space-y-4">
      {/* Header: Date + Status */}
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-gray-900">{dateStr}</p>
        <Badge variant={st.variant} dot>{st.label}</Badge>
      </div>

      {/* Key metrics — single compact grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Sales */}
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Total Sales</p>
          <p className="text-lg font-bold text-blue-700 mt-0.5">{fmt(sales.total)}</p>
          <p className="text-[10px] text-blue-400 mt-0.5">{sales.transaction_count} txn · avg {fmt(sales.average_transaction)}</p>
        </div>

        {/* POS vs Actual */}
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">POS / Actual</p>
          <p className="text-lg font-bold text-gray-900 mt-0.5">{fmt(closing.actual_total)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">POS {fmt(closing.pos_total)}</p>
        </div>

        {/* Variance */}
        <div className={`rounded-xl p-3 text-center ${variance === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${variance === 0 ? 'text-green-500' : 'text-red-500'}`}>Variance</p>
          <p className={`text-lg font-bold mt-0.5 ${variance === 0 ? 'text-green-600' : 'text-red-600'}`}>
            {variance === 0 ? '✓ $0' : `${variance > 0 ? '+' : '-'}${fmt(varianceAbs)}`}
          </p>
          <p className={`text-[10px] mt-0.5 ${variance === 0 ? 'text-green-400' : 'text-red-400'}`}>
            {variance === 0 ? 'Balanced' : variance > 0 ? 'Over' : 'Short'}
          </p>
        </div>
      </div>

      {/* Extra info row (bank deposit, HR cash) */}
      {(closing.bank_deposit > 0 || closing.hr_cash > 0) && (
        <div className="flex gap-3">
          {closing.bank_deposit > 0 && (
            <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">Bank Deposit</span>
              <span className="text-sm font-semibold text-gray-900">{fmt(closing.bank_deposit)}</span>
            </div>
          )}
          {closing.hr_cash > 0 && (
            <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">HR Cash</span>
              <span className="text-sm font-semibold text-gray-900">{fmt(closing.hr_cash)}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
