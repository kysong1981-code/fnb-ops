import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { payrollAPI } from '../../services/api'

export default function PayslipDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [payslip, setPayslip] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPayslip()
  }, [id])

  const fetchPayslip = async () => {
    setLoading(true)
    setError('')
    try {
      const [payslipRes, summaryRes] = await Promise.all([
        payrollAPI.getPayslip(id),
        payrollAPI.getPayslipSummary(id),
      ])
      setPayslip(payslipRes.data)
      setSummary(summaryRes.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load payslip.')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v) => `$${parseFloat(v || 0).toFixed(2)}`

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="text-gray-600 mt-4">Loading payslip...</p>
      </div>
    )
  }

  if (!payslip || !summary) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded">
        {error || 'Payslip not found.'}
      </div>
    )
  }

  const workTypeLabel = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CASUAL: 'Casual',
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <button onClick={() => navigate(-1)} className="text-blue-600 hover:text-blue-800 text-sm mb-1">
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Pay Slip</h1>
          <p className="text-gray-500 text-sm">{summary.employee}</p>
        </div>
        {payslip.is_locked && (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Finalised</span>
        )}
      </div>

      {/* Info Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Pay Period</p>
          <p className="font-medium text-gray-900">{summary.period}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Payment Date</p>
          <p className="font-medium text-gray-900">
            {payslip.pay_period_details?.payment_date}
          </p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">IRD Number</p>
          <p className="font-medium text-gray-900">{payslip.tax_file_number || 'N/A'}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Tax Code</p>
          <p className="font-medium text-gray-900">{summary.tax_code || payslip.tax_code || 'M'}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Work Type</p>
          <p className="font-medium text-gray-900">{workTypeLabel[payslip.work_type] || payslip.work_type}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Employee ID</p>
          <p className="font-medium text-gray-900">{payslip.employee_id || '-'}</p>
        </div>
      </div>

      {/* Hours */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Hours Worked</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Regular</p>
            <p className="text-lg font-bold text-blue-600">{summary.hours.regular}h</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Overtime</p>
            <p className="text-lg font-bold text-orange-600">{summary.hours.overtime}h</p>
          </div>
          {summary.hours.public_holiday > 0 && (
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Public Holiday</p>
              <p className="text-lg font-bold text-purple-600">{summary.hours.public_holiday}h</p>
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold text-gray-900">{summary.hours.total}h</p>
          </div>
        </div>
      </div>

      {/* Earnings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Earnings</h2>
        <div className="space-y-2">
          <Row label={`Regular Pay (${fmt(payslip.hourly_rate)}/h)`} value={fmt(summary.earnings.regular_pay)} />
          {summary.earnings.overtime_pay > 0 && (
            <Row label={`Overtime Pay (${fmt(payslip.overtime_rate)}/h)`} value={fmt(summary.earnings.overtime_pay)} />
          )}
          {summary.earnings.public_holiday_pay > 0 && (
            <Row label="Public Holiday Pay (T&H extra)" value={fmt(summary.earnings.public_holiday_pay)} />
          )}
          {summary.earnings.holiday_pay > 0 && (
            <Row label="Holiday Pay (8%)" value={fmt(summary.earnings.holiday_pay)} />
          )}
          <div className="border-t border-gray-200 pt-2">
            <Row label="Gross Pay" value={fmt(summary.earnings.gross_salary)} bold />
          </div>
        </div>
      </div>

      {/* Deductions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Deductions</h2>
        <div className="space-y-2">
          <Row label="PAYE Income Tax" value={`-${fmt(summary.deductions.paye_tax)}`} red />
          {summary.deductions.kiwisaver > 0 && (
            <Row label={`KiwiSaver Employee (${payslip.kiwisaver_rate || '3'}%)`} value={`-${fmt(summary.deductions.kiwisaver)}`} red />
          )}
          {summary.deductions.student_loan > 0 && (
            <Row label="Student Loan (12%)" value={`-${fmt(summary.deductions.student_loan)}`} red />
          )}
          {summary.deductions.other > 0 && (
            <Row label="Other Deductions" value={`-${fmt(summary.deductions.other)}`} red />
          )}
          <div className="border-t border-gray-200 pt-2">
            <Row label="Total Deductions" value={`-${fmt(summary.deductions.total)}`} bold red />
          </div>
        </div>
      </div>

      {/* Net Pay */}
      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">Net Pay</p>
        <p className="text-3xl font-bold text-green-600">{fmt(summary.net_salary)}</p>
      </div>

      {/* Employer Contributions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Employer Contributions (Info)</h2>
        <div className="space-y-2">
          {summary.employer_contributions.kiwisaver > 0 && (
            <Row label="KiwiSaver Employer (3%)" value={`+${fmt(summary.employer_contributions.kiwisaver)}`} />
          )}
          {summary.employer_contributions.esct > 0 && (
            <Row label="ESCT" value={`+${fmt(summary.employer_contributions.esct)}`} />
          )}
          {summary.employer_contributions.acc_levy > 0 && (
            <Row label="ACC Employer Levy" value={`+${fmt(summary.employer_contributions.acc_levy)}`} />
          )}
        </div>
      </div>

      {/* Alternative Holidays */}
      {summary.alternative_holidays_earned > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-indigo-800">
            Alternative Holidays Earned: {summary.alternative_holidays_earned} day(s)
          </p>
          <p className="text-xs text-indigo-600 mt-1">
            From working on public holidays that were otherwise working days.
          </p>
        </div>
      )}

      {/* Notes */}
      {payslip.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Notes</h3>
          <p className="text-sm text-gray-700 whitespace-pre-line">{payslip.notes}</p>
        </div>
      )}

      {/* Legal */}
      <div className="text-xs text-gray-400 text-center py-2">
        Generated in accordance with the NZ Employment Relations Act 2000 and Holidays Act 2003.
      </div>
    </div>
  )
}

function Row({ label, value, bold, red }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${red ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  )
}
