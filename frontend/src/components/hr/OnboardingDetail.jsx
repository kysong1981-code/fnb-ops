import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { hrAPI } from '../../services/api'
import SignaturePad from '../ui/SignaturePad'
import DocumentSigningView from './DocumentSigningView'

const API_BASE = 'http://localhost:8000'

const inputCls =
  'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'text-xs text-gray-500 mb-1 block'

const TAX_CODES = [
  { value: 'M', label: 'M \u2014 Primary employment' },
  { value: 'ME', label: 'ME \u2014 Primary + student loan' },
  { value: 'SB', label: 'SB \u2014 Secondary <$14k' },
  { value: 'S', label: 'S \u2014 Secondary $14k\u2013$48k' },
  { value: 'SH', label: 'SH \u2014 Secondary $48k\u2013$70k' },
  { value: 'ST', label: 'ST \u2014 Secondary $70k\u2013$180k' },
  { value: 'SA', label: 'SA \u2014 Secondary >$180k' },
  { value: 'CAE', label: 'CAE \u2014 Casual agricultural' },
  { value: 'EDW', label: 'EDW \u2014 Election day worker' },
  { value: 'ND', label: 'ND \u2014 No declaration' },
]

const SECTION_ORDER = [
  'PERSONAL_INFO',
  'BANK_ACCOUNT',
  'IR330',
  'CONTRACT',
  'JOB_OFFER',
  'JOB_DESCRIPTION',
  'DOCUMENT_SIGN',   // fallback for other document types
  'FILE_UPLOAD',
  'TRAINING',
  'CUSTOM',
]

const SECTION_META = {
  PERSONAL_INFO: { label: 'Personal Information', desc: 'Confirm your personal details with your manager' },
  BANK_ACCOUNT: { label: 'Bank Account', desc: 'Provide your bank account details to your manager' },
  IR330: { label: 'IR330 Tax Declaration', desc: 'Complete your NZ tax declaration' },
  CONTRACT: { label: 'Employment Contract', desc: 'Review and sign your employment contract' },
  JOB_OFFER: { label: 'Job Offer', desc: 'Review and sign your job offer letter' },
  JOB_DESCRIPTION: { label: 'Job Description', desc: 'Review and sign your job description' },
  DOCUMENT_SIGN: { label: 'Documents', desc: 'Review and sign the required documents' },
  FILE_UPLOAD: { label: 'File Uploads', desc: 'Upload the required documents' },
  TRAINING: { label: 'Training', desc: 'Complete the required training modules' },
  CUSTOM: { label: 'Other Tasks', desc: 'Additional onboarding tasks' },
}

const DOC_TYPE_SECTIONS = new Set(['CONTRACT', 'JOB_OFFER', 'JOB_DESCRIPTION'])

function groupByStepType(tasks) {
  const groups = {}
  tasks
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((task) => {
      let type = task.step_type || 'CUSTOM'
      // Split DOCUMENT_SIGN by document type into separate sections
      if (type === 'DOCUMENT_SIGN' && task.related_document_detail?.document_type) {
        const docType = task.related_document_detail.document_type
        if (DOC_TYPE_SECTIONS.has(docType)) {
          type = docType
        }
      }
      if (!groups[type]) groups[type] = []
      groups[type].push(task)
    })
  return groups
}

/* ───────── Section Card wrapper ───────── */
function SectionCard({ index, title, desc, allCompleted, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
            allCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {allCompleted ? '\u2713' : index}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400 truncate">{desc}</p>
        </div>
        {allCompleted && (
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
            Completed
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

/* ═══════════════════ Main Component ═══════════════════ */
export default function OnboardingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [onboarding, setOnboarding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null) // taskId being acted on

  // IR330 form
  const [ir330, setIr330] = useState({
    ird_number: '',
    tax_code: 'M',
    is_nz_resident: true,
    has_student_loan: false,
  })
  const [showTaxGuide, setShowTaxGuide] = useState(false)
  const [ir330SignMode, setIr330SignMode] = useState(false) // false=form, true=signature

  // Bank account form
  const [bankAccount, setBankAccount] = useState('')

  // Signature modal state
  const [signingDoc, setSigningDoc] = useState(null) // { docId, taskId, title }

  useEffect(() => {
    fetchOnboarding()
  }, [id])

  const fetchOnboarding = async () => {
    setLoading(true)
    try {
      const res = await hrAPI.getOnboarding(id)
      setOnboarding(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load onboarding')
    } finally {
      setLoading(false)
    }
  }

  /* ─── Task actions ─── */
  const handleToggleTask = async (taskId, isCompleted) => {
    setActionLoading(taskId)
    setError('')
    try {
      if (isCompleted) {
        await hrAPI.incompleteOnboardingTask(taskId)
      } else {
        await hrAPI.completeOnboardingTask(taskId)
      }
      await fetchOnboarding()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update task')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSignDocument = async ({ signature, initials }) => {
    if (!signingDoc) return
    const { docId, taskId } = signingDoc
    setActionLoading(taskId)
    setError('')
    try {
      await hrAPI.signDocument(docId, { signature, initials })
      await hrAPI.completeOnboardingTask(taskId)
      setSigningDoc(null)
      await fetchOnboarding()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sign document')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUploadFile = async (taskId, file) => {
    setActionLoading(taskId)
    setError('')
    try {
      const formData = new FormData()
      formData.append('uploaded_file', file)
      await hrAPI.updateOnboardingTask(taskId, formData)
      // Mark complete
      await hrAPI.completeOnboardingTask(taskId)
      await fetchOnboarding()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSubmitBankAccount = async (taskId) => {
    if (!bankAccount.trim()) {
      setError('Bank account number is required')
      return
    }
    setActionLoading(taskId)
    setError('')
    try {
      await hrAPI.saveBankAccount({ bank_account: bankAccount.trim() })
      await hrAPI.completeOnboardingTask(taskId)
      await fetchOnboarding()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save bank account')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSubmitIR330 = async (taskId, signatureBase64) => {
    if (!ir330.ird_number) {
      setError('IRD number is required')
      return
    }
    if (!signatureBase64) {
      setError('Signature is required for IR330')
      return
    }
    setActionLoading(taskId)
    setError('')
    try {
      await hrAPI.submitIR330({
        ...ir330,
        onboarding: onboarding.id,
        signature: signatureBase64,
      })
      await hrAPI.completeOnboardingTask(taskId)
      setIr330SignMode(false)
      await fetchOnboarding()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit IR330')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCompleteOnboarding = async () => {
    setActionLoading('complete')
    setError('')
    try {
      await hrAPI.completeOnboarding(id)
      await fetchOnboarding()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete onboarding')
    } finally {
      setActionLoading(null)
    }
  }

  /* ─── Document view / download ─── */
  const handleViewDocument = async (docId) => {
    try {
      const res = await hrAPI.previewDocument(docId)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      setError('Failed to load document preview')
    }
  }

  const handleDownloadDocument = async (docId, title) => {
    try {
      const res = await hrAPI.downloadDocument(docId)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Failed to download document')
    }
  }

  /* ─── Render helpers ─── */

  const renderPersonalInfoSection = (tasks, sectionIdx) => {
    const allDone = tasks.every((t) => t.is_completed)
    return (
      <SectionCard
        key="PERSONAL_INFO"
        index={sectionIdx}
        title={SECTION_META.PERSONAL_INFO.label}
        desc={SECTION_META.PERSONAL_INFO.desc}
        allCompleted={allDone}
      >
        {tasks.map((task) => (
          <div key={task.id} className="space-y-3">
            <p className="text-sm text-gray-600">
              Please confirm your personal information (full name, date of birth, phone number, address) with your
              manager or HR representative.
            </p>
            {!task.is_completed ? (
              <button
                onClick={() => handleToggleTask(task.id, false)}
                disabled={actionLoading === task.id}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {actionLoading === task.id ? 'Saving...' : 'Mark as Completed'}
              </button>
            ) : (
              <button
                onClick={() => handleToggleTask(task.id, true)}
                disabled={actionLoading === task.id}
                className="px-4 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition"
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </SectionCard>
    )
  }

  const renderBankAccountSection = (tasks, sectionIdx) => {
    const allDone = tasks.every((t) => t.is_completed)
    return (
      <SectionCard
        key="BANK_ACCOUNT"
        index={sectionIdx}
        title={SECTION_META.BANK_ACCOUNT.label}
        desc={SECTION_META.BANK_ACCOUNT.desc}
        allCompleted={allDone}
      >
        {tasks.map((task) =>
          task.is_completed ? (
            <div key={task.id} className="flex items-center justify-between">
              <p className="text-sm text-green-700 font-medium">Bank account saved</p>
              <button
                onClick={() => handleToggleTask(task.id, true)}
                disabled={actionLoading === task.id}
                className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-50 transition"
              >
                Undo
              </button>
            </div>
          ) : (
            <div key={task.id} className="space-y-4">
              <p className="text-sm text-gray-600">
                Enter your NZ bank account number for salary payments.
              </p>
              <div>
                <label className={labelCls}>Bank Account Number *</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="e.g. 06-0123-0456789-00"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">NZ format: BB-bbbb-AAAAAAA-SSS</p>
              </div>
              <button
                onClick={() => handleSubmitBankAccount(task.id)}
                disabled={actionLoading === task.id || !bankAccount.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {actionLoading === task.id ? 'Saving...' : 'Save Bank Account'}
              </button>
            </div>
          )
        )}
      </SectionCard>
    )
  }

  const renderIR330Section = (tasks, sectionIdx) => {
    const allDone = tasks.every((t) => t.is_completed)
    return (
      <SectionCard
        key="IR330"
        index={sectionIdx}
        title={SECTION_META.IR330.label}
        desc={SECTION_META.IR330.desc}
        allCompleted={allDone}
      >
        {tasks.map((task) =>
          task.is_completed ? (
            <div key={task.id} className="flex items-center justify-between">
              <p className="text-sm text-green-700 font-medium">IR330 submitted successfully</p>
              <button
                onClick={() => handleToggleTask(task.id, true)}
                disabled={actionLoading === task.id}
                className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-50 transition"
              >
                Undo
              </button>
            </div>
          ) : (
            <div key={task.id} className="space-y-4">
              {/* Tax Code Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-blue-900">What is IR330?</p>
                  <button
                    type="button"
                    onClick={() => setShowTaxGuide(!showTaxGuide)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    {showTaxGuide ? 'Hide Guide' : 'Help me choose a tax code'}
                  </button>
                </div>
                <p className="text-xs text-blue-800">
                  IR330 is a New Zealand tax code declaration form. Your employer needs this to deduct the correct amount of tax from your pay.
                </p>

                {showTaxGuide && (
                  <div className="mt-3 space-y-3 text-xs text-blue-900">
                    <div className="bg-white rounded-lg p-3 space-y-2">
                      <p className="font-bold text-sm">Tax Code Flowchart</p>

                      <div className="space-y-1.5">
                        <p className="font-semibold">Is this your main (primary) job?</p>
                        <div className="ml-3 space-y-1">
                          <p>
                            <span className="font-medium">Yes</span> + No student loan →{' '}
                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-800 rounded font-bold">M</span>
                          </p>
                          <p>
                            <span className="font-medium">Yes</span> + Student loan →{' '}
                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-800 rounded font-bold">ME</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="font-semibold">Is this your secondary job?</p>
                        <div className="ml-3 space-y-1">
                          <p>
                            Annual income {'<'} $14,000 →{' '}
                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">SB</span>
                          </p>
                          <p>
                            $14,000 – $48,000 →{' '}
                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">S</span>
                          </p>
                          <p>
                            $48,000 – $70,000 →{' '}
                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">SH</span>
                          </p>
                          <p>
                            $70,000 – $180,000 →{' '}
                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">ST</span>
                          </p>
                          <p>
                            {'>'} $180,000 →{' '}
                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">SA</span>
                          </p>
                        </div>
                      </div>

                      <div className="pt-1 border-t border-blue-100">
                        <p className="text-blue-600">
                          <strong>Most employees:</strong> If this is your only job and you don't have a student loan, choose <strong>M</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3">
                      <p className="font-bold mb-1">What is an IRD Number?</p>
                      <p>Your IRD (Inland Revenue Department) number is your unique tax number in New Zealand. It's either 8 or 9 digits (e.g. 12-345-678). If you don't have one, apply at <strong>ird.govt.nz</strong></p>
                    </div>
                  </div>
                )}
              </div>

              {/* Form or Signature mode */}
              {!ir330SignMode ? (
                <>
                  <div>
                    <label className={labelCls}>IRD Number *</label>
                    <input
                      type="text"
                      value={ir330.ird_number}
                      onChange={(e) => setIr330({ ...ir330, ird_number: e.target.value })}
                      placeholder="e.g. 12-345-678"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Tax Code *</label>
                    <select
                      value={ir330.tax_code}
                      onChange={(e) => setIr330({ ...ir330, tax_code: e.target.value })}
                      className={inputCls}
                    >
                      {TAX_CODES.map((tc) => (
                        <option key={tc.value} value={tc.value}>
                          {tc.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ir330.is_nz_resident}
                        onChange={(e) => setIr330({ ...ir330, is_nz_resident: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      NZ Tax Resident
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ir330.has_student_loan}
                        onChange={(e) => setIr330({ ...ir330, has_student_loan: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      Student Loan
                    </label>
                  </div>
                  <button
                    onClick={() => {
                      if (!ir330.ird_number) {
                        setError('IRD number is required')
                        return
                      }
                      setError('')
                      setIr330SignMode(true)
                    }}
                    disabled={!ir330.ird_number}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    Next: Sign Declaration
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
                    <p className="font-semibold mb-2">Declaration Summary</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <p><span className="text-gray-500">IRD Number:</span> {ir330.ird_number}</p>
                      <p><span className="text-gray-500">Tax Code:</span> {ir330.tax_code}</p>
                      <p><span className="text-gray-500">NZ Resident:</span> {ir330.is_nz_resident ? 'Yes' : 'No'}</p>
                      <p><span className="text-gray-500">Student Loan:</span> {ir330.has_student_loan ? 'Yes' : 'No'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIr330SignMode(false)}
                      className="text-xs text-blue-600 hover:underline mt-2"
                    >
                      ← Edit details
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    I declare that the information I have provided is true and correct.
                  </p>
                  <SignaturePad
                    onSave={(base64) => handleSubmitIR330(task.id, base64)}
                    onCancel={() => setIr330SignMode(false)}
                  />
                </div>
              )}
            </div>
          )
        )}
      </SectionCard>
    )
  }

  const renderSingleDocSection = (tasks, sectionIdx, sectionType) => {
    const meta = SECTION_META[sectionType] || SECTION_META.DOCUMENT_SIGN
    const allDone = tasks.every((t) => t.is_completed)

    return (
      <SectionCard
        key={sectionType}
        index={sectionIdx}
        title={meta.label}
        desc={meta.desc}
        allCompleted={allDone}
      >
        {tasks.map((task) => {
          const doc = task.related_document_detail
          return (
            <div key={task.id} className="space-y-4">
              <div
                className={`p-4 rounded-xl border ${
                  task.is_completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <p className="text-sm font-semibold text-gray-900 mb-3">{task.title}</p>

                <div className="flex flex-wrap items-center gap-2">
                  {/* View PDF */}
                  {doc?.file && (
                    <button
                      onClick={() => handleViewDocument(doc.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View PDF
                    </button>
                  )}

                  {/* Sign */}
                  {!task.is_completed && doc && !doc.is_signed && (
                    <button
                      onClick={() => setSigningDoc({ docId: doc.id, taskId: task.id, title: task.title })}
                      disabled={actionLoading === task.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      {actionLoading === task.id ? 'Signing...' : 'Sign'}
                    </button>
                  )}

                  {/* Download (only after signed) */}
                  {task.is_completed && doc?.is_signed && (
                    <button
                      onClick={() => handleDownloadDocument(doc.id, task.title)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  )}

                  {/* Signed badge */}
                  {task.is_completed && (
                    <span className="text-xs font-semibold text-green-600 ml-auto flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Signed
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </SectionCard>
    )
  }

  const renderDocumentSection = (tasks, sectionIdx) =>
    renderSingleDocSection(tasks, sectionIdx, 'DOCUMENT_SIGN')

  const renderFileUploadSection = (tasks, sectionIdx) => {
    const allDone = tasks.every((t) => t.is_completed)
    return (
      <SectionCard
        key="FILE_UPLOAD"
        index={sectionIdx}
        title={SECTION_META.FILE_UPLOAD.label}
        desc={SECTION_META.FILE_UPLOAD.desc}
        allCompleted={allDone}
      >
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id}>
              <p className="text-sm font-semibold text-gray-900 mb-2">
                {task.upload_label || task.title}
              </p>
              {task.is_completed ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-sm font-medium">Uploaded</span>
                    {task.uploaded_file && (
                      <a
                        href={`${API_BASE}${task.uploaded_file}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View file
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleTask(task.id, true)}
                    disabled={actionLoading === task.id}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Re-upload
                  </button>
                </div>
              ) : (
                <FileUploadInput
                  taskId={task.id}
                  loading={actionLoading === task.id}
                  onUpload={(file) => handleUploadFile(task.id, file)}
                />
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    )
  }

  const renderTrainingSection = (tasks, sectionIdx) => {
    const allDone = tasks.every((t) => t.is_completed)
    return (
      <SectionCard
        key="TRAINING"
        index={sectionIdx}
        title={SECTION_META.TRAINING.label}
        desc={SECTION_META.TRAINING.desc}
        allCompleted={allDone}
      >
        <div className="space-y-4">
          {tasks.map((task) => {
            const training = task.related_training_detail
            return (
              <div
                key={task.id}
                className={`p-4 rounded-xl border ${
                  task.is_completed
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                    {training?.description && (
                      <p className="text-xs text-gray-500 mt-1">{training.description}</p>
                    )}
                    {training && (
                      <div className="flex gap-2 mt-2">
                        {training.file && (
                          <a
                            href={`${API_BASE}${training.file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition"
                          >
                            PDF Material
                          </a>
                        )}
                        {training.video_url && (
                          <a
                            href={training.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs text-blue-600 hover:bg-blue-50 transition"
                          >
                            Watch Video
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {!task.is_completed ? (
                      <button
                        onClick={() => handleToggleTask(task.id, false)}
                        disabled={actionLoading === task.id}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {actionLoading === task.id ? '...' : 'Complete'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleTask(task.id, true)}
                        disabled={actionLoading === task.id}
                        className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-50 transition"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>
    )
  }

  const renderCustomSection = (tasks, sectionIdx) => {
    const allDone = tasks.every((t) => t.is_completed)
    return (
      <SectionCard
        key="CUSTOM"
        index={sectionIdx}
        title={SECTION_META.CUSTOM.label}
        desc={SECTION_META.CUSTOM.desc}
        allCompleted={allDone}
      >
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer"
              onClick={() => handleToggleTask(task.id, task.is_completed)}
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                  task.is_completed
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300'
                }`}
              >
                {task.is_completed && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    task.is_completed ? 'line-through text-gray-400' : 'text-gray-900'
                  }`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>
                )}
              </div>
              {actionLoading === task.id && (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    )
  }

  const SECTION_RENDERERS = {
    PERSONAL_INFO: renderPersonalInfoSection,
    BANK_ACCOUNT: renderBankAccountSection,
    IR330: renderIR330Section,
    CONTRACT: (tasks, idx) => renderSingleDocSection(tasks, idx, 'CONTRACT'),
    JOB_OFFER: (tasks, idx) => renderSingleDocSection(tasks, idx, 'JOB_OFFER'),
    JOB_DESCRIPTION: (tasks, idx) => renderSingleDocSection(tasks, idx, 'JOB_DESCRIPTION'),
    DOCUMENT_SIGN: renderDocumentSection,
    FILE_UPLOAD: renderFileUploadSection,
    TRAINING: renderTrainingSection,
    CUSTOM: renderCustomSection,
  }

  /* ─── Loading / Error states ─── */
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!onboarding) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error || 'Onboarding not found'}
        </div>
        <button
          onClick={() => navigate('/hr')}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          &larr; Back to HR
        </button>
      </div>
    )
  }

  const groupedTasks = groupByStepType(onboarding.tasks)
  const totalTasks = onboarding.tasks.length
  const completedTasks = onboarding.tasks.filter((t) => t.is_completed).length
  const allDone = totalTasks > 0 && completedTasks === totalTasks

  // Build ordered sections
  let sectionIdx = 0
  const sections = []
  SECTION_ORDER.forEach((type) => {
    if (groupedTasks[type] && groupedTasks[type].length > 0) {
      sectionIdx++
      const renderer = SECTION_RENDERERS[type]
      if (renderer) {
        sections.push(renderer(groupedTasks[type], sectionIdx))
      }
    }
  })

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/hr')}
          className="text-sm text-gray-400 hover:text-gray-600 font-medium mb-3 inline-block"
        >
          &larr; Back to HR
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{onboarding.employee_name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{onboarding.employee_id}</p>
          </div>
          <StatusBadge status={onboarding.status} />
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Progress</p>
          <p className="text-sm font-bold text-gray-900">{onboarding.completed_percentage}%</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              allDone ? 'bg-green-500' : 'bg-blue-600'
            }`}
            style={{ width: `${onboarding.completed_percentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>
            {completedTasks} of {totalTasks} completed
          </span>
          {onboarding.completed_at && (
            <span>Completed {new Date(onboarding.completed_at).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Sections */}
      {sections}

      {/* Interactive Document Signing View */}
      {signingDoc && (
        <DocumentSigningView
          docId={signingDoc.docId}
          taskId={signingDoc.taskId}
          docTitle={signingDoc.title}
          onComplete={() => {
            setSigningDoc(null)
            fetchOnboarding()
          }}
          onCancel={() => setSigningDoc(null)}
        />
      )}

      {/* Complete Onboarding */}
      {onboarding.status === 'IN_PROGRESS' && (
        <div className="pt-2">
          <button
            onClick={handleCompleteOnboarding}
            disabled={!allDone || actionLoading === 'complete'}
            className="w-full py-3.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {actionLoading === 'complete'
              ? 'Completing...'
              : allDone
              ? 'Complete Onboarding'
              : `Complete all tasks to finish (${totalTasks - completedTasks} remaining)`}
          </button>
        </div>
      )}

      {/* Notes */}
      {onboarding.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-yellow-700 mb-1">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{onboarding.notes}</p>
        </div>
      )}
    </div>
  )
}

/* ───────── Sub-components ───────── */

function StatusBadge({ status }) {
  const map = {
    IN_PROGRESS: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'In Progress' },
    COMPLETED: { bg: 'bg-green-50', text: 'text-green-700', label: 'Completed' },
    ON_HOLD: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'On Hold' },
  }
  const s = map[status] || map.IN_PROGRESS
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function FileUploadInput({ taskId, loading, onUpload }) {
  const fileRef = useRef(null)

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }

  return (
    <div
      onClick={() => !loading && fileRef.current?.click()}
      className={`border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition ${
        loading ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <input ref={fileRef} type="file" className="hidden" onChange={handleChange} />
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Uploading...</span>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">Click to select a file</p>
          <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG (max 10MB)</p>
        </>
      )}
    </div>
  )
}
