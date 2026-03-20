import { useState, useEffect, useRef, Fragment } from 'react'
import { cqTransactionAPI } from '../../services/api'
import Card from '../ui/Card'
import { PlusIcon, TrashIcon } from '../icons'

const TX_TYPES = [
  { key: 'COLLECTION', label: '수금', color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'INCENTIVE', label: '인센티브', color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'PROFIT', label: '수익배분', color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'EXPENSE', label: '비용', color: 'text-red-600', bg: 'bg-red-50' },
  { key: 'TRANSFER', label: '이체', color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'EXCHANGE', label: '환전', color: 'text-teal-600', bg: 'bg-teal-50' },
]

const ACCOUNT_TYPES = [
  { key: 'CASH', label: 'Cash' },
  { key: 'ACCOUNT', label: 'Account' },
  { key: 'KRW', label: 'KRW' },
]

const VIEWS = [
  { key: 'summary', label: '요약' },
  { key: 'stores', label: '매장별' },
  { key: 'persons', label: '개인장부' },
  { key: 'all', label: '전체내역' },
  { key: 'import', label: 'CSV 임포트' },
]

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function localDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function CQCashFlow() {
  const [view, setView] = useState('summary')
  const [dateStart, setDateStart] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 5)
    d.setDate(1)
    return localDateStr(d)
  })
  const [dateEnd, setDateEnd] = useState(() => localDateStr(new Date()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Data
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [storesList, setStoresList] = useState([])
  const [personsList, setPersonsList] = useState([])
  const [storeLedger, setStoreLedger] = useState(null)
  const [personalLedger, setPersonalLedger] = useState(null)
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedPerson, setSelectedPerson] = useState('')

  // New transaction form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    date: localDateStr(new Date()),
    store_name: '', transaction_type: 'COLLECTION',
    person: '', amount: '', account_type: 'CASH', note: '',
  })

  // CSV import
  const [importFile, setImportFile] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const fileRef = useRef(null)

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  const inputCls = 'px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  useEffect(() => {
    loadData()
  }, [dateStart, dateEnd])

  useEffect(() => {
    if (view === 'stores' && selectedStore) loadStoreLedger()
    if (view === 'persons' && selectedPerson) loadPersonalLedger()
  }, [selectedStore, selectedPerson, dateStart, dateEnd])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const params = { date_start: dateStart, date_end: dateEnd }
      const [sumRes, storesRes, personsRes] = await Promise.all([
        cqTransactionAPI.summary(params),
        cqTransactionAPI.storesList(),
        cqTransactionAPI.personsList(),
      ])
      setSummary(sumRes.data)
      setStoresList(storesRes.data.stores || [])
      setPersonsList(personsRes.data.persons || [])
    } catch (e) {
      setError('데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  const loadAllTransactions = async () => {
    try {
      const res = await cqTransactionAPI.list({ date_start: dateStart, date_end: dateEnd })
      setTransactions(res.data.results || res.data || [])
    } catch (e) {
      setError('거래 내역을 불러오지 못했습니다')
    }
  }

  const loadStoreLedger = async () => {
    if (!selectedStore) return
    try {
      const res = await cqTransactionAPI.storeLedger({
        store_name: selectedStore, date_start: dateStart, date_end: dateEnd,
      })
      setStoreLedger(res.data)
    } catch (e) {
      setError('매장 장부를 불러오지 못했습니다')
    }
  }

  const loadPersonalLedger = async () => {
    if (!selectedPerson) return
    try {
      const res = await cqTransactionAPI.personalLedger({
        person: selectedPerson, date_start: dateStart, date_end: dateEnd,
      })
      setPersonalLedger(res.data)
    } catch (e) {
      setError('개인 장부를 불러오지 못했습니다')
    }
  }

  const handleCreate = async () => {
    if (!form.amount || !form.date) return
    try {
      await cqTransactionAPI.create({
        ...form,
        amount: parseFloat(form.amount),
      })
      showMsg('거래가 등록되었습니다')
      setForm({ date: localDateStr(new Date()), store_name: '', transaction_type: 'COLLECTION', person: '', amount: '', account_type: 'CASH', note: '' })
      setShowForm(false)
      loadData()
      if (view === 'all') loadAllTransactions()
    } catch (e) {
      setError('거래 등록에 실패했습니다')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await cqTransactionAPI.delete(id)
      showMsg('삭제되었습니다')
      loadData()
      if (view === 'all') loadAllTransactions()
      if (view === 'stores') loadStoreLedger()
      if (view === 'persons') loadPersonalLedger()
    } catch (e) {
      setError('삭제 실패')
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    const formData = new FormData()
    formData.append('file', importFile)
    try {
      setLoading(true)
      const res = await cqTransactionAPI.importCSV(formData)
      setImportResult(res.data)
      if (res.data.created_count > 0) {
        showMsg(`${res.data.created_count}건 임포트 완료`)
        loadData()
      }
    } catch (e) {
      setError('CSV 임포트 실패')
    } finally {
      setLoading(false)
      setImportFile(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleExport = async () => {
    try {
      const res = await cqTransactionAPI.exportCSV({ date_start: dateStart, date_end: dateEnd })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `cq_transactions_${dateStart}_${dateEnd}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError('CSV 내보내기 실패')
    }
  }

  const getTxType = (key) => TX_TYPES.find(t => t.key === key) || TX_TYPES[0]

  // ============ RENDER ============

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800">💰 Cash Flow</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
            className={inputCls + ' w-36'} />
          <span className="text-gray-400">→</span>
          <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
            className={inputCls + ' w-36'} />
          <button onClick={() => { setShowForm(true) }}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 flex items-center gap-1">
            <PlusIcon className="w-4 h-4" /> 추가
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}
      {success && <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm">{success}</div>}

      {/* View Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {VIEWS.map(v => (
          <button key={v.key}
            onClick={() => {
              setView(v.key)
              if (v.key === 'all') loadAllTransactions()
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              view === v.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* New Transaction Form */}
      {showForm && (
        <Card>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">거래 추가</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                className={inputCls} />
              <select value={form.transaction_type} onChange={e => setForm({...form, transaction_type: e.target.value})}
                className={inputCls}>
                {TX_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <select value={form.account_type} onChange={e => setForm({...form, account_type: e.target.value})}
                className={inputCls}>
                {ACCOUNT_TYPES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
              <input placeholder="매장명" value={form.store_name} onChange={e => setForm({...form, store_name: e.target.value})}
                className={inputCls} list="store-suggestions" />
              <datalist id="store-suggestions">
                {storesList.map(s => <option key={s} value={s} />)}
              </datalist>
              <input placeholder="수령인" value={form.person} onChange={e => setForm({...form, person: e.target.value})}
                className={inputCls} list="person-suggestions" />
              <datalist id="person-suggestions">
                {personsList.map(p => <option key={p} value={p} />)}
              </datalist>
              <input type="number" placeholder="금액" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                className={inputCls} />
            </div>
            <input placeholder="메모" value={form.note} onChange={e => setForm({...form, note: e.target.value})}
              className={inputCls + ' w-full'} />
            <button onClick={handleCreate}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              등록
            </button>
          </div>
        </Card>
      )}

      {loading && <div className="text-center py-8 text-gray-400">Loading...</div>}

      {/* ===== SUMMARY VIEW ===== */}
      {view === 'summary' && summary && !loading && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: '수금', value: summary.totals.collection, color: 'text-green-600', bg: 'bg-green-50' },
              { label: '인센티브', value: summary.totals.incentive, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: '수익배분', value: summary.totals.profit, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: '비용', value: summary.totals.expense, color: 'text-red-600', bg: 'bg-red-50' },
              { label: '잔액', value: summary.totals.net, color: summary.totals.net >= 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-gray-50' },
            ].map(kpi => (
              <div key={kpi.label} className={`${kpi.bg} rounded-2xl p-4`}>
                <div className="text-xs text-gray-500 mb-1">{kpi.label}</div>
                <div className={`text-lg font-bold ${kpi.color}`}>{fmt(kpi.value)}</div>
              </div>
            ))}
          </div>

          {/* Store Summary */}
          {summary.stores?.length > 0 && (
            <Card>
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-3">📊 매장별 현황</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-4">매장</th>
                        <th className="pb-2 pr-4 text-right">수금</th>
                        <th className="pb-2 pr-4 text-right">인센티브</th>
                        <th className="pb-2 text-right">수익배분</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.stores.map(s => (
                        <tr key={s.store_name} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                          onClick={() => { setSelectedStore(s.store_name); setView('stores') }}>
                          <td className="py-2.5 pr-4 font-medium text-gray-800">{s.store_name}</td>
                          <td className="py-2.5 pr-4 text-right text-green-600">{fmt(s.collection)}</td>
                          <td className="py-2.5 pr-4 text-right text-purple-600">{fmt(s.incentive)}</td>
                          <td className="py-2.5 text-right text-blue-600">{fmt(s.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}

          {/* Person Summary */}
          {summary.persons?.length > 0 && (
            <Card>
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-3">👤 수령인별 현황</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-4">이름</th>
                        <th className="pb-2 pr-4 text-right">인센티브</th>
                        <th className="pb-2 pr-4 text-right">수익배분</th>
                        <th className="pb-2 text-right">총 수령</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.persons.map(p => (
                        <tr key={p.person} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                          onClick={() => { setSelectedPerson(p.person); setView('persons') }}>
                          <td className="py-2.5 pr-4 font-medium text-gray-800">{p.person}</td>
                          <td className="py-2.5 pr-4 text-right text-purple-600">{fmt(p.by_type.incentive)}</td>
                          <td className="py-2.5 pr-4 text-right text-blue-600">{fmt(p.by_type.profit)}</td>
                          <td className="py-2.5 text-right font-semibold text-gray-800">{fmt(p.total_received)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}

          {!summary.stores?.length && !summary.persons?.length && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <div>거래 내역이 없습니다</div>
              <div className="text-xs mt-1">CSV 임포트 또는 직접 추가해주세요</div>
            </div>
          )}
        </div>
      )}

      {/* ===== STORE VIEW ===== */}
      {view === 'stores' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
              className={inputCls + ' flex-1'}>
              <option value="">매장 선택...</option>
              {storesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {storeLedger && selectedStore && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">총 수금</div>
                  <div className="text-lg font-bold text-green-600">{fmt(storeLedger.total_collection)}</div>
                </div>
                <div className="bg-red-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">총 배분</div>
                  <div className="text-lg font-bold text-red-600">{fmt(storeLedger.total_distributed)}</div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">잔액</div>
                  <div className={`text-lg font-bold ${storeLedger.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(storeLedger.balance)}
                  </div>
                </div>
              </div>
              <Card>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">{selectedStore} 거래 내역</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 pr-3">날짜</th>
                          <th className="pb-2 pr-3">유형</th>
                          <th className="pb-2 pr-3">수령인</th>
                          <th className="pb-2 pr-3 text-right">수입</th>
                          <th className="pb-2 pr-3 text-right">지출</th>
                          <th className="pb-2 text-right">잔액</th>
                          <th className="pb-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {storeLedger.ledger?.map(item => {
                          const txType = getTxType(item.transaction_type)
                          return (
                            <tr key={item.id} className="border-b border-gray-50">
                              <td className="py-2 pr-3 text-gray-600">{item.date}</td>
                              <td className="py-2 pr-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${txType.bg} ${txType.color}`}>
                                  {txType.label}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-gray-800">{item.person}</td>
                              <td className="py-2 pr-3 text-right text-green-600">
                                {item.income > 0 ? fmt(item.income) : ''}
                              </td>
                              <td className="py-2 pr-3 text-right text-red-600">
                                {item.expense > 0 ? fmt(item.expense) : ''}
                              </td>
                              <td className="py-2 text-right font-medium text-gray-800">{fmt(item.balance)}</td>
                              <td className="py-2 pl-2">
                                <button onClick={() => handleDelete(item.id)}
                                  className="text-gray-300 hover:text-red-500">
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </>
          )}
          {!selectedStore && (
            <div className="text-center py-12 text-gray-400">매장을 선택해주세요</div>
          )}
        </div>
      )}

      {/* ===== PERSON VIEW ===== */}
      {view === 'persons' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)}
              className={inputCls + ' flex-1'}>
              <option value="">수령인 선택...</option>
              {personsList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {personalLedger && selectedPerson && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">총 수입</div>
                  <div className="text-lg font-bold text-green-600">{fmt(personalLedger.total_income)}</div>
                </div>
                <div className="bg-red-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">총 지출</div>
                  <div className="text-lg font-bold text-red-600">{fmt(personalLedger.total_expense)}</div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="text-xs text-gray-500">잔액</div>
                  <div className={`text-lg font-bold ${personalLedger.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(personalLedger.balance)}
                  </div>
                </div>
              </div>
              <Card>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">👤 {selectedPerson} 장부</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="pb-2 pr-3">날짜</th>
                          <th className="pb-2 pr-3">매장</th>
                          <th className="pb-2 pr-3">유형</th>
                          <th className="pb-2 pr-3 text-right">수입</th>
                          <th className="pb-2 pr-3 text-right">지출</th>
                          <th className="pb-2 pr-3">메모</th>
                          <th className="pb-2 text-right">잔액</th>
                          <th className="pb-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {personalLedger.ledger?.map(item => {
                          const txType = getTxType(item.transaction_type)
                          return (
                            <tr key={item.id} className="border-b border-gray-50">
                              <td className="py-2 pr-3 text-gray-600">{item.date}</td>
                              <td className="py-2 pr-3 text-gray-800">{item.store_name}</td>
                              <td className="py-2 pr-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${txType.bg} ${txType.color}`}>
                                  {txType.label}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-right text-green-600">
                                {item.income > 0 ? fmt(item.income) : ''}
                              </td>
                              <td className="py-2 pr-3 text-right text-red-600">
                                {item.expense > 0 ? fmt(item.expense) : ''}
                              </td>
                              <td className="py-2 pr-3 text-gray-500 text-xs max-w-[120px] truncate">{item.note}</td>
                              <td className="py-2 text-right font-medium text-gray-800">{fmt(item.balance)}</td>
                              <td className="py-2 pl-2">
                                <button onClick={() => handleDelete(item.id)}
                                  className="text-gray-300 hover:text-red-500">
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </>
          )}
          {!selectedPerson && (
            <div className="text-center py-12 text-gray-400">수령인을 선택해주세요</div>
          )}
        </div>
      )}

      {/* ===== ALL TRANSACTIONS VIEW ===== */}
      {view === 'all' && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">전체 거래 내역</h3>
              <button onClick={handleExport}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200">
                CSV 내보내기
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-3">날짜</th>
                    <th className="pb-2 pr-3">매장</th>
                    <th className="pb-2 pr-3">유형</th>
                    <th className="pb-2 pr-3">수령인</th>
                    <th className="pb-2 pr-3 text-right">금액</th>
                    <th className="pb-2 pr-3">계좌</th>
                    <th className="pb-2 pr-3">메모</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => {
                    const txType = getTxType(tx.transaction_type)
                    return (
                      <tr key={tx.id} className="border-b border-gray-50">
                        <td className="py-2 pr-3 text-gray-600">{tx.date}</td>
                        <td className="py-2 pr-3 text-gray-800">{tx.store_name}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${txType.bg} ${txType.color}`}>
                            {txType.label}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-gray-800">{tx.person}</td>
                        <td className="py-2 pr-3 text-right font-medium">
                          {fmt(tx.amount)}
                        </td>
                        <td className="py-2 pr-3 text-gray-500 text-xs">{tx.account_type}</td>
                        <td className="py-2 pr-3 text-gray-500 text-xs max-w-[150px] truncate">{tx.note}</td>
                        <td className="py-2 pl-2">
                          <button onClick={() => handleDelete(tx.id)}
                            className="text-gray-300 hover:text-red-500">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">거래 내역이 없습니다</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* ===== CSV IMPORT VIEW ===== */}
      {view === 'import' && (
        <div className="space-y-4">
          <Card>
            <div className="p-4 space-y-4">
              <h3 className="font-semibold text-gray-800">📥 CSV 임포트</h3>
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                <div className="font-medium mb-2">CSV 형식 (컬럼명 필수):</div>
                <code className="block bg-white p-3 rounded-lg text-xs overflow-x-auto whitespace-pre">
{`date,store,type,person,amount,account_type,note,period,incentive_rate
2026-01-01,Q Airport,COLLECTION,,18200,CASH,월 수금,,
2026-03-31,Q Airport,INCENTIVE,jongjin,7885,CASH,인센티브,2025-Oct,0.1
2026-03-31,Q Airport,PROFIT,sky,49675,CASH,수익배분,2025-Oct,
2026-03-31,,EXPENSE,yong,80000,CASH,김사장님,,`}
                </code>
                <div className="mt-3 text-xs space-y-1">
                  <div><strong>type 옵션:</strong> COLLECTION(수금), INCENTIVE(인센티브), PROFIT(수익배분), EXPENSE(비용), TRANSFER(이체), EXCHANGE(환전)</div>
                  <div><strong>account_type 옵션:</strong> CASH, ACCOUNT, KRW (기본: CASH)</div>
                  <div><strong>period:</strong> 반기 표시 (선택, e.g. 2025-Oct)</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="file" accept=".csv" ref={fileRef}
                  onChange={e => setImportFile(e.target.files[0])}
                  className={inputCls + ' flex-1'} />
                <button onClick={handleImport} disabled={!importFile || loading}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {loading ? '처리중...' : '임포트'}
                </button>
              </div>

              {importResult && (
                <div className={`rounded-xl p-4 ${importResult.created_count > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="font-medium text-sm">
                    ✅ {importResult.created_count}건 성공
                    {importResult.error_count > 0 && (
                      <span className="text-red-600 ml-2">❌ {importResult.error_count}건 실패</span>
                    )}
                  </div>
                  {importResult.errors?.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 space-y-1">
                      {importResult.errors.map((err, i) => <div key={i}>{err}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Template Download */}
          <Card>
            <div className="p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">📋 빠른 임포트 템플릿</h3>
              <p className="text-sm text-gray-500">
                매달 가게별 현금 수금 데이터를 빠르게 입력하세요.
                엑셀에서 CSV로 저장 후 업로드하면 됩니다.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => {
                  const template = 'date,store,type,person,amount,account_type,note,period,incentive_rate\n'
                    + storesList.map(s => `${localDateStr(new Date())},${s},COLLECTION,,0,CASH,월 수금,,`).join('\n')
                  const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = 'collection_template.csv'
                  a.click()
                }}
                  className="px-4 py-3 bg-green-50 text-green-700 rounded-xl text-sm hover:bg-green-100 text-left">
                  <div className="font-medium">📥 수금 템플릿</div>
                  <div className="text-xs text-green-500 mt-1">등록된 {storesList.length}개 매장 포함</div>
                </button>
                <button onClick={handleExport}
                  className="px-4 py-3 bg-gray-50 text-gray-700 rounded-xl text-sm hover:bg-gray-100 text-left">
                  <div className="font-medium">📤 현재 데이터 CSV 내보내기</div>
                  <div className="text-xs text-gray-500 mt-1">백업 또는 수정 후 재업로드</div>
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
