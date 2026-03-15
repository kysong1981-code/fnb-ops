import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { hrAPI } from '../../services/api'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'employment', label: 'Employment' },
  { id: 'wages', label: 'Wages & Time' },
  { id: 'leave', label: 'Leave' },
  { id: 'training', label: 'Training' },
  { id: 'disciplinary', label: 'Disciplinary' },
  { id: 'performance', label: 'Performance' },
  { id: 'health_safety', label: 'H&S' },
  { id: 'documents', label: 'Documents' },
  { id: 'notes', label: 'Notes' },
  { id: 'timeline', label: 'Timeline' },
]

const STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-800',
  LEAVE: 'bg-yellow-100 text-yellow-800',
  TERMINATED: 'bg-red-100 text-red-800',
  RESIGNED: 'bg-gray-100 text-gray-800',
}

const RATING_COLORS = {
  EXCEEDS: 'text-green-600',
  MEETS: 'text-blue-600',
  BELOW: 'text-yellow-600',
  UNSATISFACTORY: 'text-red-600',
}

const INJURY_COLORS = {
  MINOR: 'bg-yellow-100 text-yellow-800',
  MODERATE: 'bg-orange-100 text-orange-800',
  SERIOUS: 'bg-red-100 text-red-800',
  NOTIFIABLE: 'bg-red-200 text-red-900',
}

const DISCIPLINARY_COLORS = {
  VERBAL_WARNING: 'bg-yellow-100 text-yellow-800',
  WRITTEN_WARNING: 'bg-orange-100 text-orange-800',
  FINAL_WARNING: 'bg-red-100 text-red-800',
  DISCIPLINARY_MEETING: 'bg-blue-100 text-blue-800',
  SUSPENSION: 'bg-purple-100 text-purple-800',
  TERMINATION: 'bg-red-200 text-red-900',
}

const TIMELINE_COLORS = {
  employment: 'bg-blue-500',
  tax: 'bg-indigo-500',
  disciplinary: 'bg-red-500',
  performance: 'bg-green-500',
  health_safety: 'bg-orange-500',
  notes: 'bg-gray-500',
  inquiries: 'bg-purple-500',
  resignation: 'bg-pink-500',
}

// =================== MODALS ===================

function AddDisciplinaryModal({ employeeId, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee: employeeId, record_type: 'VERBAL_WARNING', date: new Date().toISOString().split('T')[0],
    subject: '', description: '', outcome: '', witness: '', follow_up_date: '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      if (file) fd.append('file', file)
      await hrAPI.createDisciplinaryRecord(fd)
      onSaved()
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message))
    }
    setSaving(false)
  }

  return (
    <ModalWrapper title="Add Disciplinary Record" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SelectField label="Type" value={form.record_type} onChange={v => setForm({...form, record_type: v})}
          options={[
            ['VERBAL_WARNING','Verbal Warning'],['WRITTEN_WARNING','Written Warning'],
            ['FINAL_WARNING','Final Warning'],['DISCIPLINARY_MEETING','Disciplinary Meeting'],
            ['SUSPENSION','Suspension'],['TERMINATION','Termination'],
          ]} />
        <InputField label="Date" type="date" value={form.date} onChange={v => setForm({...form, date: v})} />
        <InputField label="Subject" value={form.subject} onChange={v => setForm({...form, subject: v})} required />
        <TextareaField label="Description" value={form.description} onChange={v => setForm({...form, description: v})} required />
        <TextareaField label="Outcome / Actions" value={form.outcome} onChange={v => setForm({...form, outcome: v})} />
        <InputField label="Witness / Support Person" value={form.witness} onChange={v => setForm({...form, witness: v})} />
        <InputField label="Follow-up Date" type="date" value={form.follow_up_date} onChange={v => setForm({...form, follow_up_date: v})} />
        <FileField label="Attachment" onChange={setFile} />
        <button type="submit" disabled={saving} className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Add Record'}
        </button>
      </form>
    </ModalWrapper>
  )
}

function AddPerformanceModal({ employeeId, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee: employeeId, overall_rating: 'MEETS',
    review_period_start: '', review_period_end: '',
    strengths: '', areas_for_improvement: '', goals: '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      if (file) fd.append('file', file)
      await hrAPI.createPerformanceReview(fd)
      onSaved()
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message))
    }
    setSaving(false)
  }

  return (
    <ModalWrapper title="Add Performance Review" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Period Start" type="date" value={form.review_period_start} onChange={v => setForm({...form, review_period_start: v})} required />
          <InputField label="Period End" type="date" value={form.review_period_end} onChange={v => setForm({...form, review_period_end: v})} required />
        </div>
        <SelectField label="Overall Rating" value={form.overall_rating} onChange={v => setForm({...form, overall_rating: v})}
          options={[['EXCEEDS','Exceeds Expectations'],['MEETS','Meets Expectations'],['BELOW','Below Expectations'],['UNSATISFACTORY','Unsatisfactory']]} />
        <TextareaField label="Strengths" value={form.strengths} onChange={v => setForm({...form, strengths: v})} />
        <TextareaField label="Areas for Improvement" value={form.areas_for_improvement} onChange={v => setForm({...form, areas_for_improvement: v})} />
        <TextareaField label="Goals for Next Period" value={form.goals} onChange={v => setForm({...form, goals: v})} />
        <FileField label="Attachment" onChange={setFile} />
        <button type="submit" disabled={saving} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Add Review'}
        </button>
      </form>
    </ModalWrapper>
  )
}

function AddAccidentModal({ employeeId, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee: employeeId, date: new Date().toISOString().split('T')[0], time: '',
    location: '', description: '', injury_type: 'MINOR', body_part_affected: '',
    first_aid_given: false, first_aid_details: '', medical_treatment_sought: false,
    days_off_work: 0, worksafe_notified: false, worksafe_reference: '',
    corrective_actions: '', witness_names: '',
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) fd.append(k, v)
      })
      if (file) fd.append('file', file)
      await hrAPI.createWorkplaceAccident(fd)
      onSaved()
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message))
    }
    setSaving(false)
  }

  return (
    <ModalWrapper title="Report Workplace Accident" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Date" type="date" value={form.date} onChange={v => setForm({...form, date: v})} required />
          <InputField label="Time" type="time" value={form.time} onChange={v => setForm({...form, time: v})} />
        </div>
        <InputField label="Location" value={form.location} onChange={v => setForm({...form, location: v})} required placeholder="e.g. Kitchen, Front counter" />
        <SelectField label="Injury Type" value={form.injury_type} onChange={v => setForm({...form, injury_type: v})}
          options={[['MINOR','Minor (first aid only)'],['MODERATE','Moderate (medical treatment)'],['SERIOUS','Serious Harm'],['NOTIFIABLE','Notifiable Event']]} />
        <TextareaField label="Description" value={form.description} onChange={v => setForm({...form, description: v})} required />
        <InputField label="Body Part Affected" value={form.body_part_affected} onChange={v => setForm({...form, body_part_affected: v})} />
        <CheckboxField label="First Aid Given" checked={form.first_aid_given} onChange={v => setForm({...form, first_aid_given: v})} />
        {form.first_aid_given && <TextareaField label="First Aid Details" value={form.first_aid_details} onChange={v => setForm({...form, first_aid_details: v})} />}
        <CheckboxField label="Medical Treatment Sought" checked={form.medical_treatment_sought} onChange={v => setForm({...form, medical_treatment_sought: v})} />
        <InputField label="Days Off Work" type="number" value={form.days_off_work} onChange={v => setForm({...form, days_off_work: v})} />
        <CheckboxField label="WorkSafe Notified" checked={form.worksafe_notified} onChange={v => setForm({...form, worksafe_notified: v})} />
        {form.worksafe_notified && <InputField label="WorkSafe Reference" value={form.worksafe_reference} onChange={v => setForm({...form, worksafe_reference: v})} />}
        <TextareaField label="Corrective Actions" value={form.corrective_actions} onChange={v => setForm({...form, corrective_actions: v})} />
        <InputField label="Witness Names" value={form.witness_names} onChange={v => setForm({...form, witness_names: v})} />
        <FileField label="Attachment (ACC form, medical cert)" onChange={setFile} />
        <button type="submit" disabled={saving} className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Report Accident'}
        </button>
      </form>
    </ModalWrapper>
  )
}

function AddNoteModal({ employeeId, onClose, onSaved }) {
  const [form, setForm] = useState({
    employee: employeeId, category: 'GENERAL', date: new Date().toISOString().split('T')[0],
    subject: '', content: '', is_confidential: false,
  })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null) fd.append(k, v) })
      if (file) fd.append('file', file)
      await hrAPI.createEmployeeNote(fd)
      onSaved()
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message))
    }
    setSaving(false)
  }

  return (
    <ModalWrapper title="Add File Note" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SelectField label="Category" value={form.category} onChange={v => setForm({...form, category: v})}
          options={[['MEETING','Meeting Notes'],['RETURN_TO_WORK','Return to Work'],['COMPLAINT','Complaint'],['GRIEVANCE','Grievance'],['GENERAL','General Note'],['OTHER','Other']]} />
        <InputField label="Date" type="date" value={form.date} onChange={v => setForm({...form, date: v})} required />
        <InputField label="Subject" value={form.subject} onChange={v => setForm({...form, subject: v})} required />
        <TextareaField label="Content" value={form.content} onChange={v => setForm({...form, content: v})} required rows={4} />
        <CheckboxField label="Confidential" checked={form.is_confidential} onChange={v => setForm({...form, is_confidential: v})} />
        <FileField label="Attachment" onChange={setFile} />
        <button type="submit" disabled={saving} className="w-full py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50">
          {saving ? 'Saving...' : 'Add Note'}
        </button>
      </form>
    </ModalWrapper>
  )
}

function AddDocumentModal({ employeeId, onClose, onSaved }) {
  const [form, setForm] = useState({ document_type: 'OTHER', title: '' })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return alert('Please select a file')
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('document_type', form.document_type)
      fd.append('title', form.title)
      fd.append('file', file)
      await hrAPI.uploadTeamDocument(employeeId, fd)
      onSaved()
    } catch (err) {
      alert('Error: ' + (err.response?.data?.detail || err.message))
    }
    setSaving(false)
  }

  return (
    <ModalWrapper title="Upload Document" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <SelectField label="Document Type" value={form.document_type} onChange={v => setForm({...form, document_type: v})}
          options={[
            ['CONTRACT','Employment Agreement'],['JOB_DESCRIPTION','Job Description'],['JOB_OFFER','Job Offer'],
            ['VARIATION','Agreement Variation'],['VISA','Visa / Work Permit'],['ID_DOCUMENT','ID Document'],
            ['CERTIFICATE','Certificate / Licence'],['MEDICAL','Medical Certificate'],['POLICE_VET','Police Vetting'],['OTHER','Other'],
          ]} />
        <InputField label="Title" value={form.title} onChange={v => setForm({...form, title: v})} required />
        <FileField label="File" onChange={setFile} accept=".pdf,.doc,.docx,.jpg,.png,.xlsx" />
        <button type="submit" disabled={saving} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </ModalWrapper>
  )
}

// =================== FORM HELPERS ===================

function ModalWrapper({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white rounded-t-xl">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function InputField({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input {...props} onChange={e => props.onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
    </div>
  )
}

function TextareaField({ label, rows = 3, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea rows={rows} {...props} onChange={e => props.onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
    </div>
  )
}

function SelectField({ label, options, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select {...props} onChange={e => props.onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  )
}

function FileField({ label, onChange, accept }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="file" accept={accept || '.pdf,.doc,.docx,.jpg,.png,.xlsx'} onChange={e => onChange(e.target.files?.[0])}
        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
    </div>
  )
}

// =================== MAIN COMPONENT ===================

export default function EmployeeFilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [modal, setModal] = useState(null) // 'disciplinary' | 'performance' | 'accident' | 'note' | 'document'

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await hrAPI.getEmployeeFile(id)
      setData(res.data)
    } catch (err) {
      console.error('Failed to load employee file:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  const handleModalSaved = () => {
    setModal(null)
    fetchData()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Employee not found</p>
    </div>
  )

  const { employee, categories, timeline } = data

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/hr')} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl">&larr;</span>
              </button>
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-blue-600">
                  {employee.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{employee.name}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  <span>{employee.job_title_display || employee.job_title}</span>
                  <span>|</span>
                  <span>{employee.employee_id}</span>
                  <span>|</span>
                  <span>{employee.work_type_display}</span>
                </div>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[employee.employment_status] || 'bg-gray-100'}`}>
              {employee.employment_status}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-4 overflow-x-auto">
          <div className="flex border-b">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.id !== 'overview' && tab.id !== 'timeline' && categories[tab.id === 'wages' ? 'wages_time' : tab.id]?.count > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                    {categories[tab.id === 'wages' ? 'wages_time' : tab.id].count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === 'overview' && <OverviewTab employee={employee} categories={categories} timeline={timeline} setActiveTab={setActiveTab} />}
          {activeTab === 'employment' && <EmploymentTab data={categories.employment} onAdd={() => setModal('document')} />}
          {activeTab === 'wages' && <WagesTab data={categories.wages_time} />}
          {activeTab === 'leave' && <LeaveTab data={categories.leave} />}
          {activeTab === 'training' && <TrainingTab data={categories.training} />}
          {activeTab === 'disciplinary' && <DisciplinaryTab data={categories.disciplinary} onAdd={() => setModal('disciplinary')} />}
          {activeTab === 'performance' && <PerformanceTab data={categories.performance} onAdd={() => setModal('performance')} />}
          {activeTab === 'health_safety' && <HealthSafetyTab data={categories.health_safety} onAdd={() => setModal('accident')} />}
          {activeTab === 'documents' && <DocumentsTab data={categories.documents} onAdd={() => setModal('document')} />}
          {activeTab === 'notes' && <NotesTab data={categories.notes} onAdd={() => setModal('note')} />}
          {activeTab === 'timeline' && <TimelineTab timeline={timeline} />}
        </div>
      </div>

      {/* Modals */}
      {modal === 'disciplinary' && <AddDisciplinaryModal employeeId={id} onClose={() => setModal(null)} onSaved={handleModalSaved} />}
      {modal === 'performance' && <AddPerformanceModal employeeId={id} onClose={() => setModal(null)} onSaved={handleModalSaved} />}
      {modal === 'accident' && <AddAccidentModal employeeId={id} onClose={() => setModal(null)} onSaved={handleModalSaved} />}
      {modal === 'note' && <AddNoteModal employeeId={id} onClose={() => setModal(null)} onSaved={handleModalSaved} />}
      {modal === 'document' && <AddDocumentModal employeeId={id} onClose={() => setModal(null)} onSaved={handleModalSaved} />}
    </div>
  )
}

// =================== TAB COMPONENTS ===================

function SectionCard({ title, count, children, onAdd, addLabel = '+ Add' }) {
  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-bold text-gray-900">
          {title} {count !== undefined && <span className="text-gray-400 font-normal">({count})</span>}
        </h3>
        {onAdd && (
          <button onClick={onAdd} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            {addLabel}
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function EmptyState({ message }) {
  return <p className="text-center text-gray-400 py-8">{message}</p>
}

function DocItem({ doc }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex-1">
        <p className="font-medium text-gray-900">{doc.title}</p>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
          <span>{doc.document_type}</span>
          <span>{doc.uploaded_at?.split('T')[0]}</span>
          {doc.uploaded_by_name && <span>by {doc.uploaded_by_name}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {doc.is_signed ? (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Signed</span>
        ) : (
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Unsigned</span>
        )}
        {doc.file && (
          <a href={doc.file} target="_blank" rel="noopener noreferrer"
            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">
            Download
          </a>
        )}
      </div>
    </div>
  )
}

// Overview Tab - Summary cards
function OverviewTab({ employee, categories, timeline, setActiveTab }) {
  const summaryCards = [
    { id: 'employment', label: 'Employment Agreements', count: categories.employment?.count || 0, color: 'blue' },
    { id: 'disciplinary', label: 'Disciplinary Records', count: categories.disciplinary?.count || 0, color: 'red' },
    { id: 'performance', label: 'Performance Reviews', count: categories.performance?.count || 0, color: 'green' },
    { id: 'health_safety', label: 'H&S Incidents', count: categories.health_safety?.count || 0, color: 'orange' },
    { id: 'documents', label: 'Other Documents', count: categories.documents?.count || 0, color: 'purple' },
    { id: 'notes', label: 'File Notes', count: categories.notes?.count || 0, color: 'gray' },
  ]

  return (
    <div className="space-y-4">
      {/* Quick Info */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-bold text-gray-900 mb-3">Employee Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Email</span><p className="font-medium">{employee.email}</p></div>
          <div><span className="text-gray-500">Phone</span><p className="font-medium">{employee.phone || '-'}</p></div>
          <div><span className="text-gray-500">Joined</span><p className="font-medium">{employee.date_of_joining || '-'}</p></div>
          <div><span className="text-gray-500">Work Type</span><p className="font-medium">{employee.work_type_display}</p></div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {summaryCards.map(card => (
          <button key={card.id} onClick={() => setActiveTab(card.id)}
            className="bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition">
            <p className="text-2xl font-bold text-gray-900">{card.count}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Onboarding Status */}
      {categories.onboarding?.data && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-gray-900 mb-2">Onboarding</h3>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              categories.onboarding.data.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>{categories.onboarding.data.status}</span>
            <span className="text-sm text-gray-600">{categories.onboarding.data.completed_percentage}% complete</span>
          </div>
        </div>
      )}

      {/* Recent Timeline */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-900">Recent Activity</h3>
          <button onClick={() => setActiveTab('timeline')} className="text-sm text-blue-600 hover:underline">View All</button>
        </div>
        {timeline.slice(0, 5).map((event, i) => (
          <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
            <div className={`w-2 h-2 rounded-full mt-2 ${TIMELINE_COLORS[event.category] || 'bg-gray-400'}`} />
            <div>
              <p className="text-sm font-medium text-gray-900">{event.title}</p>
              <p className="text-xs text-gray-500">{event.date}</p>
            </div>
          </div>
        ))}
        {timeline.length === 0 && <EmptyState message="No activity recorded yet" />}
      </div>
    </div>
  )
}

// Employment Tab
function EmploymentTab({ data, onAdd }) {
  return (
    <SectionCard title="Employment Agreements" count={data?.count} onAdd={onAdd} addLabel="+ Upload">
      {data?.items?.length > 0 ? data.items.map(doc => <DocItem key={doc.id} doc={doc} />) : <EmptyState message="No employment documents" />}
      {/* Tax Declarations shown together */}
    </SectionCard>
  )
}

// Wages & Time Tab
function WagesTab({ data }) {
  return (
    <div className="space-y-4">
      {/* Salary History */}
      <SectionCard title="Salary History">
        {data?.salary_history?.length > 0 ? (
          <div className="space-y-2">
            {data.salary_history.map(s => (
              <div key={s.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <span className="font-bold text-lg">${parseFloat(s.hourly_rate).toFixed(2)}/hr</span>
                  {s.is_active && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Current</span>}
                </div>
                <span className="text-sm text-gray-500">
                  {s.effective_from} {s.effective_to ? `~ ${s.effective_to}` : '~ present'}
                </span>
              </div>
            ))}
          </div>
        ) : <EmptyState message="No salary records" />}
      </SectionCard>

      {/* Timesheet Summary */}
      <SectionCard title="Timesheet Summary">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{data?.timesheet_summary?.total_records || 0}</p>
            <p className="text-sm text-gray-500">Total Records</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{data?.timesheet_summary?.earliest || '-'}</p>
            <p className="text-sm text-gray-500">Earliest</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{data?.timesheet_summary?.latest || '-'}</p>
            <p className="text-sm text-gray-500">Latest</p>
          </div>
        </div>
      </SectionCard>

      {/* Recent Payslips */}
      <SectionCard title="Recent Payslips" count={data?.recent_payslips?.length}>
        {data?.recent_payslips?.length > 0 ? (
          <div className="space-y-2">
            {data.recent_payslips.map(p => (
              <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className="text-sm text-gray-600">{p.pay_period_start} ~ {p.pay_period_end}</span>
                <div className="text-right">
                  <p className="font-bold">${parseFloat(p.net_pay).toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Gross: ${parseFloat(p.gross_pay).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState message="No payslips yet" />}
      </SectionCard>
    </div>
  )
}

// Leave Tab
function LeaveTab({ data }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Leave Balances">
        {data?.balances?.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {data.balances.map((b, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-700">{b.leave_type}</p>
                <p className="text-xl font-bold text-gray-900">{b.remaining_days} <span className="text-sm font-normal text-gray-500">/ {b.total_days} days</span></p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min((b.used_days / b.total_days) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState message="No leave balances" />}
      </SectionCard>

      <SectionCard title="Leave Requests" count={data?.recent_requests?.length}>
        {data?.recent_requests?.length > 0 ? (
          data.recent_requests.map(lr => (
            <div key={lr.id} className="flex justify-between items-center py-2 border-b last:border-0">
              <div>
                <p className="font-medium text-sm">{lr.leave_type}</p>
                <p className="text-xs text-gray-500">{lr.start_date} ~ {lr.end_date}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                lr.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                lr.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
              }`}>{lr.status}</span>
            </div>
          ))
        ) : <EmptyState message="No leave requests" />}
      </SectionCard>
    </div>
  )
}

// Training Tab
function TrainingTab({ data }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Training Tasks" count={data?.training_tasks?.length}>
        {data?.training_tasks?.length > 0 ? (
          data.training_tasks.map(t => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  t.is_completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                }`}>{t.is_completed ? '✓' : ''}</span>
                <span className="text-sm">{t.title}</span>
              </div>
              {t.completed_at && <span className="text-xs text-gray-500">{t.completed_at.split('T')[0]}</span>}
            </div>
          ))
        ) : <EmptyState message="No training records" />}
      </SectionCard>

      <SectionCard title="Certificates & Licences" count={data?.certificates?.length}>
        {data?.certificates?.length > 0 ? data.certificates.map(doc => <DocItem key={doc.id} doc={doc} />) : <EmptyState message="No certificates" />}
      </SectionCard>
    </div>
  )
}

// Disciplinary Tab
function DisciplinaryTab({ data, onAdd }) {
  return (
    <SectionCard title="Disciplinary Records" count={data?.count} onAdd={onAdd} addLabel="+ Add Warning">
      {data?.items?.length > 0 ? (
        data.items.map(d => (
          <div key={d.id} className="py-3 border-b last:border-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DISCIPLINARY_COLORS[d.record_type] || 'bg-gray-100'}`}>
                  {d.record_type_display}
                </span>
                <span className="font-medium text-gray-900">{d.subject}</span>
              </div>
              <span className="text-sm text-gray-500">{d.date}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{d.description}</p>
            {d.outcome && <p className="text-sm text-gray-500 mt-1"><strong>Outcome:</strong> {d.outcome}</p>}
            {d.witness && <p className="text-xs text-gray-400 mt-1">Witness: {d.witness}</p>}
            <div className="flex items-center gap-3 mt-2">
              {d.acknowledged_by_employee ? (
                <span className="text-xs text-green-600">Acknowledged {d.acknowledged_at?.split('T')[0]}</span>
              ) : (
                <span className="text-xs text-yellow-600">Not acknowledged</span>
              )}
              {d.file && <a href={d.file} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View attachment</a>}
              {d.issued_by_name && <span className="text-xs text-gray-400">By: {d.issued_by_name}</span>}
            </div>
          </div>
        ))
      ) : <EmptyState message="No disciplinary records" />}
    </SectionCard>
  )
}

// Performance Tab
function PerformanceTab({ data, onAdd }) {
  return (
    <SectionCard title="Performance Reviews" count={data?.count} onAdd={onAdd} addLabel="+ Add Review">
      {data?.items?.length > 0 ? (
        data.items.map(p => (
          <div key={p.id} className="py-3 border-b last:border-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`font-bold ${RATING_COLORS[p.overall_rating] || ''}`}>{p.overall_rating_display}</span>
              </div>
              <span className="text-sm text-gray-500">{p.review_period_start} ~ {p.review_period_end}</span>
            </div>
            {p.strengths && <p className="text-sm mt-2"><strong className="text-green-600">Strengths:</strong> {p.strengths}</p>}
            {p.areas_for_improvement && <p className="text-sm mt-1"><strong className="text-orange-600">Improve:</strong> {p.areas_for_improvement}</p>}
            {p.goals && <p className="text-sm mt-1"><strong className="text-blue-600">Goals:</strong> {p.goals}</p>}
            <div className="flex items-center gap-3 mt-2">
              {p.reviewer_name && <span className="text-xs text-gray-400">Reviewer: {p.reviewer_name}</span>}
              {p.file && <a href={p.file} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View attachment</a>}
            </div>
          </div>
        ))
      ) : <EmptyState message="No performance reviews" />}
    </SectionCard>
  )
}

// Health & Safety Tab
function HealthSafetyTab({ data, onAdd }) {
  return (
    <SectionCard title="Workplace Accidents" count={data?.count} onAdd={onAdd} addLabel="+ Report">
      {data?.items?.length > 0 ? (
        data.items.map(a => (
          <div key={a.id} className="py-3 border-b last:border-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INJURY_COLORS[a.injury_type] || 'bg-gray-100'}`}>
                  {a.injury_type_display}
                </span>
                <span className="font-medium text-gray-900">{a.location}</span>
              </div>
              <span className="text-sm text-gray-500">{a.date}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{a.description}</p>
            <div className="flex flex-wrap gap-3 mt-2 text-xs">
              {a.body_part_affected && <span className="text-gray-500">Injury: {a.body_part_affected}</span>}
              {a.first_aid_given && <span className="text-green-600">First aid given</span>}
              {a.medical_treatment_sought && <span className="text-blue-600">Medical treatment</span>}
              {a.days_off_work > 0 && <span className="text-red-600">{a.days_off_work} days off</span>}
              {a.worksafe_notified && <span className="text-purple-600">WorkSafe notified: {a.worksafe_reference}</span>}
              {a.file && <a href={a.file} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Attachment</a>}
            </div>
          </div>
        ))
      ) : <EmptyState message="No workplace accidents recorded" />}
    </SectionCard>
  )
}

// Documents Tab
function DocumentsTab({ data, onAdd }) {
  return (
    <SectionCard title="Other Documents" count={data?.count} onAdd={onAdd} addLabel="+ Upload">
      {data?.items?.length > 0 ? data.items.map(doc => <DocItem key={doc.id} doc={doc} />) : <EmptyState message="No documents" />}
    </SectionCard>
  )
}

// Notes Tab
function NotesTab({ data, onAdd }) {
  return (
    <SectionCard title="File Notes" count={data?.count} onAdd={onAdd} addLabel="+ Add Note">
      {data?.items?.length > 0 ? (
        data.items.map(n => (
          <div key={n.id} className="py-3 border-b last:border-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">{n.category_display}</span>
                <span className="font-medium text-gray-900">{n.subject}</span>
                {n.is_confidential && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">Confidential</span>}
              </div>
              <span className="text-sm text-gray-500">{n.date}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{n.content}</p>
            <div className="flex items-center gap-3 mt-1">
              {n.created_by_name && <span className="text-xs text-gray-400">By: {n.created_by_name}</span>}
              {n.file && <a href={n.file} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Attachment</a>}
            </div>
          </div>
        ))
      ) : <EmptyState message="No file notes" />}
    </SectionCard>
  )
}

// Timeline Tab
function TimelineTab({ timeline }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-gray-900 mb-4">Complete Timeline</h3>
      {timeline.length > 0 ? (
        <div className="space-y-0">
          {timeline.map((event, i) => (
            <div key={i} className="flex gap-4 pb-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${TIMELINE_COLORS[event.category] || 'bg-gray-400'}`} />
                {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
              </div>
              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-gray-400 uppercase">{event.category.replace('_', ' ')}</span>
                  <span className="text-xs text-gray-400">{event.date}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{event.title}</p>
                {event.detail && <p className="text-xs text-gray-500 mt-0.5">{event.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState message="No events recorded" />}
    </div>
  )
}
