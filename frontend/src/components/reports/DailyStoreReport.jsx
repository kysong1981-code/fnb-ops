import Card from '../ui/Card'
import KpiCard from '../ui/KpiCard'
import Badge from '../ui/Badge'
import SectionLabel from '../ui/SectionLabel'

export default function DailyStoreReport({ data }) {
  const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const statusMap = {
    APPROVED: { variant: 'success', label: 'Approved' },
    DRAFT: { variant: 'warning', label: 'Draft' },
    REJECTED: { variant: 'danger', label: 'Rejected' },
    NOT_STARTED: { variant: 'neutral', label: 'Not Started' },
  }

  if (!data) return null
  const { closing, sales, date } = data

  const dateStr = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  const st = statusMap[closing.status] || statusMap.NOT_STARTED
  const varianceAbs = Math.abs(closing.variance)

  return (
    <div className="space-y-6">
      {/* Date + Status */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Report Date</p>
            <p className="text-lg font-bold text-gray-900">{dateStr}</p>
          </div>
          <Badge variant={st.variant} dot>{st.label}</Badge>
        </div>
      </Card>

      {/* Closing KPI */}
      <SectionLabel>Closing Summary</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="POS Total" value={fmt(closing.pos_total)} />
        <KpiCard label="Actual Total" value={fmt(closing.actual_total)} />
        <KpiCard
          label="Variance"
          value={closing.variance === 0 ? '$0.00' : `${closing.variance > 0 ? '+' : '-'}${fmt(varianceAbs)}`}
          alert={closing.variance !== 0 ? (closing.variance < 0 ? 'Short' : 'Over') : undefined}
        />
        {closing.bank_deposit > 0 && (
          <KpiCard label="Bank Deposit" value={fmt(closing.bank_deposit)} />
        )}
      </div>

      {/* HR Cash */}
      {closing.hr_cash > 0 && (
        <KpiCard label="HR Cash" value={fmt(closing.hr_cash)} sub="Staff cash disbursement" />
      )}

      {/* Sales KPI */}
      <SectionLabel>Sales Summary</SectionLabel>
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total Sales" value={fmt(sales.total)} />
        <KpiCard label="Transactions" value={`${sales.transaction_count}`} />
        <KpiCard label="Avg. Transaction" value={fmt(sales.average_transaction)} />
      </div>
    </div>
  )
}
