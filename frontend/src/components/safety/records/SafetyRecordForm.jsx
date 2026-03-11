import { useState } from 'react'
import { XIcon, CheckCircleIcon } from '../../icons'

/**
 * 동적 폼 렌더러 — record_type.default_fields JSON 기반으로 폼 자동 생성
 *
 * Field types: checkbox, text, number, textarea, select, date, time
 * Each field: { key, label, label_ko, type, required, options }
 */
export default function SafetyRecordForm({ recordType, onSubmit, onClose, initialData = {} }) {
  const fields = recordType.default_fields || []
  const [formData, setFormData] = useState(() => {
    const initial = { ...initialData }
    fields.forEach(f => {
      if (!(f.key in initial)) {
        if (f.type === 'checkbox') initial[f.key] = false
        else if (f.type === 'number') initial[f.key] = ''
        else initial[f.key] = ''
      }
    })
    initial._notes = ''
    return initial
  })
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(formData)
    } catch (err) {
      console.error('Form submit error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Check all checkboxes helper
  const checkboxFields = fields.filter(f => f.type === 'checkbox')
  const allChecked = checkboxFields.length > 0 && checkboxFields.every(f => formData[f.key])

  const handleCheckAll = () => {
    const newData = { ...formData }
    const targetValue = !allChecked
    checkboxFields.forEach(f => { newData[f.key] = targetValue })
    setFormData(newData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{recordType.name}</h2>
            {recordType.name_ko && (
              <p className="text-xs text-gray-400">{recordType.name_ko}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"
          >
            <XIcon size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body — scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Check All button for checkbox-heavy forms */}
            {checkboxFields.length > 3 && (
              <button
                type="button"
                onClick={handleCheckAll}
                className={`w-full py-2 px-4 rounded-xl text-sm font-medium border transition-colors ${
                  allChecked
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {allChecked ? '✓ All Checked' : 'Check All Items'}
              </button>
            )}

            {fields.map(field => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={formData[field.key]}
                onChange={(val) => handleChange(field.key, val)}
              />
            ))}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Notes / 비고
              </label>
              <textarea
                value={formData._notes}
                onChange={(e) => handleChange('_notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                rows={2}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          {/* Submit button — fixed at bottom */}
          <div className="p-4 border-t border-gray-100 bg-white">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white font-bold rounded-xl text-base transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <CheckCircleIcon size={20} />
              {submitting ? 'Saving...' : 'Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


function FieldRenderer({ field, value, onChange }) {
  const label = (
    <span>
      {field.label}
      {field.label_ko && <span className="text-gray-400 ml-1.5">({field.label_ko})</span>}
      {field.required && <span className="text-red-400 ml-0.5">*</span>}
    </span>
  )

  switch (field.type) {
    case 'checkbox':
      return (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
            value
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-white border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
            value ? 'bg-emerald-500 text-white' : 'bg-gray-100 border border-gray-300'
          }`}>
            {value && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span className={`text-sm ${value ? 'text-emerald-800 font-medium' : 'text-gray-700'}`}>
            {label}
          </span>
        </button>
      )

    case 'text':
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder={field.placeholder || ''}
          />
        </div>
      )

    case 'number':
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            step={field.step || 'any'}
            min={field.min}
            max={field.max}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder={field.placeholder || ''}
          />
        </div>
      )

    case 'textarea':
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            rows={3}
            placeholder={field.placeholder || ''}
          />
        </div>
      )

    case 'select':
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Select...</option>
            {(field.options || []).map(opt => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        </div>
      )

    case 'date':
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      )

    case 'time':
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <input
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      )

    default:
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      )
  }
}
