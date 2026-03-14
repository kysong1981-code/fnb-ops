import { useState } from 'react'
import { reportsAPI, salesAnalysisAPI } from '../../services/api'
import Card from '../ui/Card'
import SectionLabel from '../ui/SectionLabel'

const TYPE_STYLES = {
  positive: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: '✅' },
  negative: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: '⚠️' },
  neutral: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', icon: 'ℹ️' },
}

export default function AIInsightsCard({ startDate, endDate, storeId, useSalesAnalysisAPI }) {
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setInsights(null)
    try {
      let res
      if (useSalesAnalysisAPI) {
        const params = { start_date: startDate, end_date: endDate }
        if (storeId) params.organization_id = storeId
        res = await salesAnalysisAPI.getAIInsights(params)
      } else {
        res = await reportsAPI.getAIInsights(startDate, endDate, storeId)
      }
      if (res.data.insights) {
        setInsights(res.data.insights)
      } else {
        setError(res.data.error || 'AI analysis unavailable.')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate AI analysis.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <SectionLabel>AI Analysis</SectionLabel>
      <Card className="p-5">
        {!insights && !loading && !error && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">
              AI가 매출 데이터를 분석하여 인사이트와 개선점을 알려드립니다.
            </p>
            <button
              onClick={handleGenerate}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-blue-700 transition shadow-sm"
            >
              🤖 AI 분석 생성
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">AI가 분석 중입니다...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-4">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
            >
              다시 시도
            </button>
          </div>
        )}

        {insights && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="flex gap-3 items-start">
              <span className="text-xl shrink-0">🤖</span>
              <p className="text-sm text-gray-800 leading-relaxed">{insights.summary}</p>
            </div>

            {/* Key Findings */}
            {insights.key_findings && insights.key_findings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">주요 발견</h4>
                <div className="grid grid-cols-1 gap-2">
                  {insights.key_findings.map((f, i) => {
                    const s = TYPE_STYLES[f.type] || TYPE_STYLES.neutral
                    return (
                      <div key={i} className={`p-3 rounded-xl border ${s.bg} ${s.border}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-sm shrink-0">{s.icon}</span>
                          <div>
                            <p className={`text-sm font-semibold ${s.text}`}>{f.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{f.description}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {insights.recommendations && insights.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">💡 개선 제안</h4>
                <div className="space-y-1.5">
                  {insights.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 bg-blue-50 rounded-lg">
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-700">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regenerate button */}
            <div className="text-center pt-2">
              <button
                onClick={handleGenerate}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                ↻ 다시 분석
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
