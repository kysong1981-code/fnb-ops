import { useState } from 'react'
import { useStore } from '../../context/StoreContext'
import { storeAPI } from '../../services/api'
import { CheckCircleIcon, UploadIcon, ChartIcon } from '../icons'

function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>{children}</div>
}

export default function ImportPage() {
  const { selectedStore } = useStore()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const isCompany = selectedStore?.is_company || (selectedStore?.sub_stores && selectedStore.sub_stores.length > 0)
  const subStoreCount = selectedStore?.sub_stores?.length || 0

  const handleDownloadTemplate = async () => {
    setDownloading(true)
    try {
      const params = selectedStore?.id ? { store_id: selectedStore.id } : {}
      const res = await storeAPI.downloadTemplate(params)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = 'OneOps_Import_Template.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Failed to download template')
    } finally {
      setDownloading(false)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file first')
      return
    }
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const params = selectedStore?.id ? { store_id: selectedStore.id } : {}
      const res = await storeAPI.importData(formData, params)
      setResult(res.data)
      setFile(null)
    } catch (err) {
      console.error('Import error:', err)
      const msg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Upload failed'
      setResult({ error: msg })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <UploadIcon size={22} />
          Data Import
        </h1>
        <p className="text-sm text-gray-500 mt-1">Upload Excel or CSV files with Sales & COGs data for reports</p>
      </div>

      <Card>
        <div className="p-5 space-y-6">
          {/* Step 1: Download Template */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">Download Template</p>
                <p className="text-xs text-blue-700 mt-1">
                  Download the Excel template with 24 monthly sheets. Your existing suppliers and sales categories are pre-filled.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloading}
                  className="mt-3 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition inline-flex items-center gap-2"
                >
                  {downloading ? 'Generating...' : 'Download Template'}
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: Fill Data */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Fill in Your Data</p>
                <ul className="text-xs text-gray-600 mt-1 space-y-1">
                  <li>&#8226; Each sheet = one month (daily columns)</li>
                  <li>&#8226; <b>Income</b>: Cash, Card = POS sales. Others = Other Sales (Uber, DoorDash, etc.)</li>
                  <li>&#8226; <b>COGs</b>: Supplier costs per day</li>
                  <li>&#8226; New company names are auto-added to Store Settings</li>
                  <li>&#8226; Leave blank or 0 for days with no data</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Company info banner */}
          {isCompany && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">i</span>
                <div>
                  <p className="text-sm font-semibold text-indigo-900">
                    Company with {subStoreCount} sub-store{subStoreCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-indigo-700 mt-1">
                    If your CSV contains data for multiple stores (GoMenu format), it will be automatically distributed to matching sub-stores.
                    Cash Tracking data will be saved to the parent company.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedStore.sub_stores?.map(s => (
                      <span key={s.id} className="px-2 py-0.5 text-[10px] bg-indigo-100 text-indigo-700 rounded-full font-medium">{s.name}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Upload */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-900">Upload Completed File</p>
                <p className="text-xs text-emerald-700 mt-1">Upload the filled template. Existing data for same dates will be overwritten.</p>
                <div className="mt-3 flex items-center gap-3">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setFile(e.target.files[0])}
                      className="hidden"
                    />
                    <div className="w-full px-4 py-3 border-2 border-dashed border-emerald-300 rounded-lg text-center cursor-pointer hover:border-emerald-500 transition">
                      {file ? (
                        <p className="text-sm font-medium text-emerald-800">{file.name}</p>
                      ) : (
                        <p className="text-sm text-emerald-600">Click to select file (.xlsx or .csv)</p>
                      )}
                    </div>
                  </label>
                  <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="px-6 py-3 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition whitespace-nowrap"
                  >
                    {uploading ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Result */}
          {result && !result.error && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircleIcon size={16} className="text-emerald-500" /> Import Complete
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{result.months_processed}</p>
                  <p className="text-[10px] text-blue-500 uppercase">Months</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{result.closings_created}</p>
                  <p className="text-[10px] text-emerald-500 uppercase">Days Created</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{result.closings_updated || 0}</p>
                  <p className="text-[10px] text-amber-500 uppercase">{result.closings_deleted ? 'Overwritten' : 'Updated'}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">
                    {(result.other_sales_created || 0) + (result.supplier_costs_created || 0)}
                  </p>
                  <p className="text-[10px] text-purple-500 uppercase">Records</p>
                </div>
              </div>

              {/* Multi-store per-store breakdown */}
              {result.multi_store && result.per_store && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Per-Store Breakdown:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(result.per_store).map(([storeName, data]) => (
                      <div key={storeName} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700 truncate mr-2">{storeName}</span>
                        <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">{data.closings_created} days</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Store mapping info for multi-store */}
              {result.store_mapping && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Store Mapping (CSV → Database):</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(result.store_mapping).map(([csvName, dbInfo]) => (
                      <span key={csvName} className="px-2 py-0.5 text-[10px] bg-indigo-100 text-indigo-700 rounded-full font-medium">
                        {csvName} → {dbInfo.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.suppliers_added?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-1">New Suppliers Added:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.suppliers_added.map(s => (
                      <span key={s} className="px-2 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded-full font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.sales_categories_added?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">New Sales Categories Added:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.sales_categories_added.map(s => (
                      <span key={s} className="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.errors?.length > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Errors:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          {result?.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700 font-medium">{result.error}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
