import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { payrollAPI } from '../../services/api'

export default function MyPayslips() {
  const navigate = useNavigate()
  const [payslips, setPayslips] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPayslips()
  }, [])

  const fetchPayslips = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await payrollAPI.getMyPayslips()
      setPayslips(res.data.results || res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load payslips.')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v) => `$${parseFloat(v || 0).toFixed(2)}`

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
        <p className="text-gray-500 text-sm">NZ compliant pay information</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : payslips.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-400">No payslips yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.map((ps) => (
            <button
              key={ps.id}
              onClick={() => navigate(`/payroll/${ps.id}`)}
              className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-blue-200 hover:shadow transition"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {ps.period_info?.start_date} ~ {ps.period_info?.end_date}
                  </p>
                  <p className="text-xs text-gray-400">
                    Payment: {ps.period_info?.payment_date}
                  </p>
                </div>
                {ps.is_locked && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Finalised</span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-gray-400">Hours</p>
                  <p className="font-semibold text-gray-800">{ps.total_hours}h</p>
                </div>
                <div>
                  <p className="text-gray-400">Gross</p>
                  <p className="font-semibold text-gray-800">{fmt(ps.gross_salary)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Deductions</p>
                  <p className="font-semibold text-red-500">{fmt(ps.total_deductions)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Net</p>
                  <p className="font-bold text-green-600">{fmt(ps.net_salary)}</p>
                </div>
              </div>
              {(parseFloat(ps.holiday_pay) > 0 || parseFloat(ps.public_holiday_pay) > 0) && (
                <div className="mt-2 flex gap-2">
                  {parseFloat(ps.holiday_pay) > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Holiday Pay {fmt(ps.holiday_pay)}</span>
                  )}
                  {parseFloat(ps.public_holiday_pay) > 0 && (
                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded">PH Pay {fmt(ps.public_holiday_pay)}</span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
