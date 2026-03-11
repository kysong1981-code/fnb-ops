import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAPI } from '../../services/api'
import ALL_MODULES from '../../constants/modules'

export default function GetStartedPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: form, 2: success
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    applicant_name: '',
    applicant_email: '',
    applicant_phone: '',
    store_name: '',
    store_address: '',
    store_phone: '',
    desired_modules: ALL_MODULES.map((m) => m.key),
  })

  const toggleModule = (key) => {
    setForm((prev) => ({
      ...prev,
      desired_modules: prev.desired_modules.includes(key)
        ? prev.desired_modules.filter((k) => k !== key)
        : [...prev.desired_modules, key],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.applicant_name || !form.applicant_email || !form.store_name) {
      setError('Name, email, and store name are required')
      return
    }

    setSaving(true)
    try {
      await adminAPI.submitStoreApplication(form)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to submit application')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  // Success screen
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">&#10003;</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your store opening application has been submitted. Our team will review it and send you an invitation once approved.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Get Started</h1>
          <p className="text-sm text-gray-500 mt-1">Open a new store with Oneops</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Applicant Info */}
            <div>
              <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
                Your Information
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Full Name *</label>
                  <input
                    type="text"
                    value={form.applicant_name}
                    onChange={(e) => setForm({ ...form, applicant_name: e.target.value })}
                    placeholder="John Doe"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Email *</label>
                  <input
                    type="email"
                    value={form.applicant_email}
                    onChange={(e) => setForm({ ...form, applicant_email: e.target.value })}
                    placeholder="john@example.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                  <input
                    type="tel"
                    value={form.applicant_phone}
                    onChange={(e) => setForm({ ...form, applicant_phone: e.target.value })}
                    placeholder="+64 21 123 4567"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Store Info */}
            <div>
              <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
                Store Information
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Store Name *</label>
                  <input
                    type="text"
                    value={form.store_name}
                    onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                    placeholder="My Cafe"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Address</label>
                  <input
                    type="text"
                    value={form.store_address}
                    onChange={(e) => setForm({ ...form, store_address: e.target.value })}
                    placeholder="123 Queen St, Auckland"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Store Phone</label>
                  <input
                    type="tel"
                    value={form.store_phone}
                    onChange={(e) => setForm({ ...form, store_phone: e.target.value })}
                    placeholder="+64 9 123 4567"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Module Selection */}
            <div>
              <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
                Features You Need
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_MODULES.map((mod) => {
                  const isEnabled = form.desired_modules.includes(mod.key)
                  return (
                    <button
                      key={mod.key}
                      type="button"
                      onClick={() => toggleModule(mod.key)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                        isEnabled
                          ? 'border-blue-200 bg-blue-50/50'
                          : 'border-gray-100 bg-gray-50/50 opacity-60'
                      }`}
                    >
                      <span className="text-lg shrink-0">{mod.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900">{mod.label}</p>
                        <p className="text-[10px] text-gray-400 line-clamp-1">{mod.desc}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isEnabled ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                        }`}
                      >
                        {isEnabled && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {form.desired_modules.length} of {ALL_MODULES.length} features selected
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || !form.applicant_name || !form.applicant_email || !form.store_name}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Already have an account? Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
