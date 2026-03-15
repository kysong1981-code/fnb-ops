import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import { storeAPI, safetyAPI, hrAPI } from '../../services/api'
import ALL_MODULES from '../../constants/modules'
import PageHeader from '../ui/PageHeader'
import Card from '../ui/Card'
import { SettingsIcon, PlusIcon, EditIcon, TrashIcon, XIcon, CheckCircleIcon, CameraIcon } from '../icons'

const NZ_REGIONS = [
  { value: 'AUCKLAND', label: 'Auckland' },
  { value: 'WELLINGTON', label: 'Wellington' },
  { value: 'CANTERBURY', label: 'Canterbury' },
  { value: 'OTAGO', label: 'Otago' },
  { value: 'WAIKATO', label: 'Waikato' },
  { value: 'BAY_OF_PLENTY', label: 'Bay of Plenty' },
  { value: 'HAWKES_BAY', label: "Hawke's Bay" },
  { value: 'TARANAKI', label: 'Taranaki' },
  { value: 'MANAWATU_WHANGANUI', label: 'Manawatū-Whanganui' },
  { value: 'NELSON', label: 'Nelson' },
  { value: 'MARLBOROUGH', label: 'Marlborough' },
  { value: 'WEST_COAST', label: 'West Coast' },
  { value: 'SOUTHLAND', label: 'Southland' },
  { value: 'NORTHLAND', label: 'Northland' },
  { value: 'GISBORNE', label: 'Gisborne' },
  { value: 'CHATHAM_ISLANDS', label: 'Chatham Islands' },
]

const TABS = [
  { key: 'modules', label: 'Modules' },
  { key: 'company', label: 'Company' },
  { key: 'business', label: 'Business' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'sales', label: 'Sales' },
  { key: 'safety', label: 'Food Safety' },
  { key: 'hr', label: 'HR Setup' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'import', label: 'Import' },
]

const INTEGRATION_INFO = {
  GOMENU: {
    name: 'GoMenu POS',
    description: 'Connect your GoMenu POS system to sync sales data automatically.',
    icon: '\uD83C\uDF5C',
    color: 'orange',
    syncable: true,
    fields: [
      { key: 'api_key', label: 'API Key', type: 'text', placeholder: 'Enter GoMenu API key' },
      { key: 'account', label: 'Account', type: 'text', placeholder: 'GoMenu login account' },
      { key: 'password', label: 'Password', type: 'password', placeholder: 'GoMenu login password' },
    ],
  },
  LIGHTSPEED: {
    name: 'Lightspeed POS',
    description: 'Integrate with Lightspeed Restaurant K-Series for real-time sales sync.',
    icon: '\u26A1',
    color: 'blue',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'text', placeholder: 'Enter Lightspeed API key' },
      { key: 'api_secret', label: 'API Secret', type: 'password', placeholder: 'Enter API secret' },
    ],
  },
  XERO: {
    name: 'Xero Accounting',
    description: 'Sync expenses, invoices, and financial data with Xero.',
    icon: '\uD83D\uDCCA',
    color: 'green',
    fields: [
      { key: 'api_key', label: 'Client ID', type: 'text', placeholder: 'Enter Xero Client ID' },
      { key: 'api_secret', label: 'Client Secret', type: 'password', placeholder: 'Enter Client Secret' },
    ],
  },
}

const TRAINING_MODULE_TYPES = [
  { value: 'SAFETY', label: 'Safety Training' },
  { value: 'FCP', label: 'FCP Training' },
  { value: 'HAZARD', label: 'Hazard Training' },
  { value: 'CUSTOM', label: 'Custom' },
]

export default function StoreSettings() {
  const { refreshProfile } = useAuth()
  const { selectedStore } = useStore()
  const storeParams = selectedStore ? { store_id: selectedStore.id } : {}
  const [tab, setTab] = useState('modules')
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Company form
  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '',
    region: '', ird_number: '',
    opening_time: '', closing_time: '',
  })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)

  // Modules
  const [enabledModules, setEnabledModules] = useState(ALL_MODULES.map(m => m.key))

  // Business
  const [hrCashEnabled, setHrCashEnabled] = useState(true)
  const [owWeeks, setOwWeeks] = useState(8)
  const [owThreshold, setOwThreshold] = useState(7)

  // Suppliers
  const [suppliers, setSuppliers] = useState([])
  const [supplierForm, setSupplierForm] = useState(null)

  // Sales Categories
  const [categories, setCategories] = useState([])
  const [categoryForm, setCategoryForm] = useState(null)

  // Temperature Locations
  const [tempLocations, setTempLocations] = useState([])
  const [tempForm, setTempForm] = useState(null)

  // Cleaning Areas
  const [cleaningAreas, setCleaningAreas] = useState([])
  const [cleaningAreaForm, setCleaningAreaForm] = useState(null)

  // Checklist Templates
  const [templates, setTemplates] = useState([])

  // MPI Record Configs
  const [recordConfigs, setRecordConfigs] = useState([])
  const [recordConfigsLoading, setRecordConfigsLoading] = useState(false)
  const [specialistOpen, setSpecialistOpen] = useState(false)

  // HR Setup: Document Templates & Training Modules
  const [docTemplates, setDocTemplates] = useState([])
  const [trainingModules, setTrainingModules] = useState([])
  const [docTemplateUploading, setDocTemplateUploading] = useState(false)
  const [trainingForm, setTrainingForm] = useState(null)

  // Job Titles (dynamic)
  const [jobTitles, setJobTitles] = useState([])
  const [jobTitleForm, setJobTitleForm] = useState(null)

  // Placeholder Preview Modal
  const [phModal, setPhModal] = useState(null) // { file, filename, known, unknown, docType, workType, jobTitle, mappings }

  // DOCX Upload Tool
  const [docxTool, setDocxTool] = useState({ file: null, result: null, loading: false, saveTarget: 'CONTRACT', saveWorkType: 'FULL_TIME', saveJobTitle: '', mappings: {} })

  // Integrations
  const [integrations, setIntegrations] = useState([])
  const [connectingService, setConnectingService] = useState(null)
  const [connectForm, setConnectForm] = useState({})
  const [testingService, setTestingService] = useState(null)
  const [syncingService, setSyncingService] = useState(null)
  const [syncResult, setSyncResult] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // Load settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await storeAPI.getSettings(storeParams)
      const d = res.data
      setSettings(d)
      setForm({
        name: d.name || '',
        address: d.address || '',
        phone: d.phone || '',
        email: d.email || '',
        region: d.region || '',
        ird_number: d.ird_number || '',
        opening_time: d.opening_time || '',
        closing_time: d.closing_time || '',
      })
      setLogoPreview(d.logo || null)
      if (d.enabled_modules && d.enabled_modules.length > 0) {
        setEnabledModules(d.enabled_modules)
      }
      setHrCashEnabled(d.hr_cash_enabled)
      setOwWeeks(d.otherwise_working_weeks)
      setOwThreshold(d.otherwise_working_threshold)
    } catch (e) {
      console.error('Failed to load settings', e)
    } finally {
      setLoading(false)
    }
  }, [selectedStore])

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await storeAPI.getSuppliers(storeParams)
      setSuppliers(res.data)
    } catch (e) { console.error(e) }
  }, [selectedStore])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await storeAPI.getSalesCategories(storeParams)
      setCategories(res.data)
    } catch (e) { console.error(e) }
  }, [selectedStore])

  const fetchTempLocations = useCallback(async () => {
    try {
      const res = await safetyAPI.getTemperatureLocations(storeParams)
      setTempLocations(res.data)
    } catch (e) { console.error(e) }
  }, [selectedStore])

  const fetchCleaningAreas = useCallback(async () => {
    try {
      const res = await safetyAPI.getCleaningAreas(storeParams)
      setCleaningAreas(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch (e) { console.error(e) }
  }, [selectedStore])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await safetyAPI.getTemplates(storeParams)
      setTemplates(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch (e) { console.error(e) }
  }, [selectedStore])

  const fetchRecordConfigs = useCallback(async () => {
    try {
      const res = await safetyAPI.getRecordConfigs(storeParams)
      setRecordConfigs(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch (e) { console.error(e) }
  }, [selectedStore])

  const fetchJobTitles = useCallback(async () => {
    try {
      const res = await storeAPI.getJobTitles(storeParams)
      setJobTitles(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch (e) { console.error(e) }
  }, [selectedStore])

  const fetchDocTemplates = useCallback(async () => {
    try {
      const res = await hrAPI.getDocumentTemplates(storeParams)
      setDocTemplates(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch (e) { console.error(e) }
  }, [selectedStore])

  const fetchTrainingModules = useCallback(async () => {
    try {
      const res = await hrAPI.getTrainingModules(storeParams)
      setTrainingModules(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch (e) { console.error(e) }
  }, [selectedStore])

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await storeAPI.getIntegrations(storeParams)
      setIntegrations(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch (e) { console.error(e) }
  }, [selectedStore])

  useEffect(() => {
    fetchSettings()
    fetchSuppliers()
    fetchCategories()
    fetchTempLocations()
    fetchCleaningAreas()
    fetchTemplates()
    fetchRecordConfigs()
    fetchJobTitles()
    fetchDocTemplates()
    fetchTrainingModules()
    fetchIntegrations()
  }, [fetchSettings, fetchSuppliers, fetchCategories, fetchTempLocations, fetchCleaningAreas, fetchTemplates, fetchRecordConfigs, fetchJobTitles, fetchDocTemplates, fetchTrainingModules, fetchIntegrations])

  // ── Company Tab ──
  const handleSaveCompany = async () => {
    setSaving(true)
    try {
      if (logoFile) {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
        fd.append('logo', logoFile)
        await storeAPI.updateSettingsWithFile(fd, storeParams)
      } else {
        const data = {}
        Object.entries(form).forEach(([k, v]) => { data[k] = v || null })
        await storeAPI.updateSettings(data, storeParams)
      }
      showToast('Settings saved')
      fetchSettings()
      setLogoFile(null)
    } catch (e) {
      showToast('Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  // ── Modules Tab ──
  const toggleModule = (key) => {
    setEnabledModules(prev =>
      prev.includes(key)
        ? prev.filter(m => m !== key)
        : [...prev, key]
    )
  }

  const handleSaveModules = async () => {
    setSaving(true)
    try {
      await storeAPI.updateSettings({ enabled_modules: enabledModules }, storeParams)
      await refreshProfile()
      showToast('Modules updated')
    } catch (e) {
      showToast('Error saving modules')
    } finally {
      setSaving(false)
    }
  }

  // ── Business Tab ──
  const handleSaveBusiness = async () => {
    setSaving(true)
    try {
      await storeAPI.updateSettings({
        hr_cash_enabled: hrCashEnabled,
        otherwise_working_weeks: owWeeks,
        otherwise_working_threshold: owThreshold,
      }, storeParams)
      showToast('Settings saved')
    } catch (e) {
      showToast('Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  // ── Suppliers ──
  const handleSaveSupplier = async () => {
    try {
      const data = { ...supplierForm, code: supplierForm.code || supplierForm.name.trim().toLowerCase().replace(/\s+/g, '_') }
      if (data.id) {
        await storeAPI.updateSupplier(data.id, data)
      } else {
        await storeAPI.createSupplier(data, storeParams)
      }
      setSupplierForm(null)
      fetchSuppliers()
      showToast('Supplier saved')
    } catch (e) {
      showToast(e.response?.data?.code?.[0] || e.response?.data?.name?.[0] || 'Error saving supplier')
    }
  }

  const handleDeleteSupplier = async (id) => {
    try {
      await storeAPI.deleteSupplier(id)
      fetchSuppliers()
      showToast('Supplier deleted')
    } catch (e) {
      showToast('Error deleting supplier')
    }
  }

  // ── Sales Categories ──
  const handleSaveCategory = async () => {
    try {
      if (categoryForm.id) {
        await storeAPI.updateSalesCategory(categoryForm.id, categoryForm)
      } else {
        await storeAPI.createSalesCategory(categoryForm, storeParams)
      }
      setCategoryForm(null)
      fetchCategories()
      showToast('Category saved')
    } catch (e) {
      showToast(e.response?.data?.name?.[0] || 'Error saving category')
    }
  }

  const handleDeleteCategory = async (id) => {
    try {
      await storeAPI.deleteSalesCategory(id)
      fetchCategories()
      showToast('Category deleted')
    } catch (e) {
      showToast('Error deleting category')
    }
  }

  // ── Temperature Locations ──
  const handleSaveTempLocation = async () => {
    try {
      const data = {
        ...tempForm,
        standard_min: tempForm.standard_min || null,
        standard_max: tempForm.standard_max || null,
      }
      if (tempForm.id) {
        await safetyAPI.updateTemperatureLocation(tempForm.id, data)
      } else {
        await safetyAPI.createTemperatureLocation(data, storeParams)
      }
      setTempForm(null)
      fetchTempLocations()
      showToast('Location saved')
    } catch (e) {
      showToast(e.response?.data?.name?.[0] || 'Error saving location')
    }
  }

  const handleDeleteTempLocation = async (id) => {
    try {
      await safetyAPI.deleteTemperatureLocation(id)
      fetchTempLocations()
      showToast('Location deleted')
    } catch (e) {
      showToast('Error deleting location')
    }
  }

  // ── Cleaning Areas ──
  const handleSaveCleaningArea = async () => {
    try {
      const data = { ...cleaningAreaForm }
      if (cleaningAreaForm.id) {
        await safetyAPI.updateCleaningArea(cleaningAreaForm.id, data)
      } else {
        await safetyAPI.createCleaningArea(data, storeParams)
      }
      setCleaningAreaForm(null)
      fetchCleaningAreas()
      showToast('Cleaning area saved')
    } catch (e) {
      showToast(e.response?.data?.name?.[0] || 'Error saving cleaning area')
    }
  }

  const handleDeleteCleaningArea = async (id) => {
    try {
      await safetyAPI.deleteCleaningArea(id)
      fetchCleaningAreas()
      showToast('Cleaning area deleted')
    } catch (e) {
      showToast('Error deleting cleaning area')
    }
  }

  // ── Job Titles ──
  const handleSaveJobTitle = async () => {
    if (!jobTitleForm) return
    try {
      const data = { code: jobTitleForm.code, label: jobTitleForm.label, is_active: jobTitleForm.is_active, sort_order: jobTitleForm.sort_order }
      if (jobTitleForm.id) {
        await storeAPI.updateJobTitle(jobTitleForm.id, data)
      } else {
        await storeAPI.createJobTitle(data, storeParams)
      }
      setJobTitleForm(null)
      fetchJobTitles()
      showToast('Job title saved')
    } catch (e) {
      showToast(e.response?.data?.code?.[0] || e.response?.data?.label?.[0] || 'Error saving job title')
    }
  }

  const handleDeleteJobTitle = async (id) => {
    try {
      await storeAPI.deleteJobTitle(id)
      fetchJobTitles()
      showToast('Job title deleted')
    } catch (e) {
      showToast('Error deleting job title')
    }
  }

  // ── DOCX Upload Tool ──
  const handleDocxToolUpload = async (file) => {
    setDocxTool(prev => ({ ...prev, file, loading: true, result: null, mappings: {} }))
    try {
      const res = await hrAPI.extractPlaceholders(file)
      const { known, unknown, known_keys } = res.data
      const mappings = {}
      unknown.forEach(ph => { mappings[ph.key] = '' })
      setDocxTool(prev => ({ ...prev, loading: false, result: { known, unknown, known_keys }, mappings }))
    } catch (e) {
      showToast('Error extracting placeholders')
      setDocxTool(prev => ({ ...prev, loading: false }))
    }
  }

  const handleDocxToolSave = async () => {
    if (!docxTool.file || !docxTool.result) return
    setDocTemplateUploading(true)
    try {
      let fileToUpload = docxTool.file

      // Fix placeholders if any mappings are set
      const activeMappings = {}
      Object.entries(docxTool.mappings).forEach(([key, val]) => {
        if (val && val !== key) activeMappings[key] = val
      })

      if (Object.keys(activeMappings).length > 0) {
        const res = await hrAPI.fixPlaceholders(docxTool.file, activeMappings)
        fileToUpload = new File([res.data], docxTool.file.name, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      }

      const fd = new FormData()
      fd.append('document_type', docxTool.saveTarget)
      fd.append('title', docxTool.file.name)
      fd.append('file', fileToUpload)
      if (docxTool.saveTarget === 'CONTRACT') fd.append('work_type', docxTool.saveWorkType)
      if (docxTool.saveTarget === 'JOB_DESCRIPTION') fd.append('job_title', docxTool.saveJobTitle)
      await hrAPI.createDocumentTemplate(fd)
      fetchDocTemplates()
      showToast('Template uploaded')
      setDocxTool({ file: null, result: null, loading: false, saveTarget: 'CONTRACT', saveWorkType: 'FULL_TIME', saveJobTitle: '', mappings: {} })
    } catch (e) {
      showToast('Error uploading template')
    } finally {
      setDocTemplateUploading(false)
    }
  }

  const handleDocxToolDownload = async () => {
    if (!docxTool.file) return
    try {
      let fileToDownload = docxTool.file

      // Apply mappings if any
      const activeMappings = {}
      Object.entries(docxTool.mappings).forEach(([key, val]) => {
        if (val && val !== key) activeMappings[key] = val
      })

      if (Object.keys(activeMappings).length > 0) {
        const res = await hrAPI.fixPlaceholders(docxTool.file, activeMappings)
        fileToDownload = new File([res.data], docxTool.file.name, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      }

      // Trigger browser download
      const url = URL.createObjectURL(fileToDownload)
      const a = document.createElement('a')
      a.href = url
      a.download = fileToDownload.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('File downloaded — edit in Word then re-upload')
    } catch (e) {
      showToast('Error downloading file')
    }
  }

  // ── HR Document Templates ──
  const handleUploadDocTemplate = async (docType, file, { workType, jobTitle } = {}) => {
    // For DOCX files, extract placeholders and show preview modal
    if (file.name.endsWith('.docx')) {
      setDocTemplateUploading(true)
      try {
        const res = await hrAPI.extractPlaceholders(file)
        const { known, unknown, known_keys } = res.data
        // Initialize mappings for unknown placeholders
        const mappings = {}
        unknown.forEach(ph => { mappings[ph.key] = '' })
        setPhModal({
          file, filename: file.name, known, unknown, known_keys,
          docType, workType, jobTitle, mappings,
        })
      } catch (e) {
        showToast('Error extracting placeholders')
      } finally {
        setDocTemplateUploading(false)
      }
      return
    }

    // Non-DOCX: upload directly
    setDocTemplateUploading(true)
    try {
      const fd = new FormData()
      fd.append('document_type', docType)
      fd.append('title', file.name)
      fd.append('file', file)
      if (workType) fd.append('work_type', workType)
      if (jobTitle) fd.append('job_title', jobTitle)
      await hrAPI.createDocumentTemplate(fd)
      fetchDocTemplates()
      showToast('Template uploaded')
    } catch (e) {
      showToast('Error uploading template')
    } finally {
      setDocTemplateUploading(false)
    }
  }

  const handlePhModalConfirm = async () => {
    if (!phModal) return
    setDocTemplateUploading(true)
    try {
      let fileToUpload = phModal.file

      // If there are any mappings that map to a known placeholder, fix the file first
      const activeMappings = {}
      Object.entries(phModal.mappings).forEach(([key, val]) => {
        if (val && val !== key) activeMappings[key] = val
      })

      if (Object.keys(activeMappings).length > 0) {
        const res = await hrAPI.fixPlaceholders(phModal.file, activeMappings)
        fileToUpload = new File([res.data], phModal.filename, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      }

      const fd = new FormData()
      fd.append('document_type', phModal.docType)
      fd.append('title', phModal.filename)
      fd.append('file', fileToUpload)
      if (phModal.workType) fd.append('work_type', phModal.workType)
      if (phModal.jobTitle) fd.append('job_title', phModal.jobTitle)
      await hrAPI.createDocumentTemplate(fd)
      fetchDocTemplates()
      showToast('Template uploaded')
      setPhModal(null)
    } catch (e) {
      showToast('Error uploading template')
    } finally {
      setDocTemplateUploading(false)
    }
  }

  const handleDeleteDocTemplate = async (id) => {
    try {
      await hrAPI.deleteDocumentTemplate(id)
      fetchDocTemplates()
      showToast('Template deleted')
    } catch (e) {
      showToast('Error deleting template')
    }
  }

  // ── HR Training Modules ──
  const handleSaveTraining = async () => {
    if (!trainingForm) return
    try {
      const fd = new FormData()
      fd.append('module_type', trainingForm.module_type)
      fd.append('title', trainingForm.title)
      if (trainingForm.description) fd.append('description', trainingForm.description)
      if (trainingForm.video_url) fd.append('video_url', trainingForm.video_url)
      if (trainingForm.file_obj) fd.append('file', trainingForm.file_obj)

      if (trainingForm.id) {
        await hrAPI.updateTrainingModule(trainingForm.id, fd)
      } else {
        await hrAPI.createTrainingModule(fd)
      }
      setTrainingForm(null)
      fetchTrainingModules()
      showToast('Training module saved')
    } catch (e) {
      showToast('Error saving training module')
    }
  }

  const handleDeleteTraining = async (id) => {
    try {
      await hrAPI.deleteTrainingModule(id)
      fetchTrainingModules()
      showToast('Training module deleted')
    } catch (e) {
      showToast('Error deleting training module')
    }
  }

  // ── Delete checklist template ──
  const handleDeleteTemplate = async (id) => {
    try {
      await safetyAPI.deleteTemplate(id)
      fetchTemplates()
      showToast('Template deleted')
    } catch (e) {
      showToast('Error deleting template')
    }
  }

  // ── MPI Record Configs ──
  const handleInitializeConfigs = async () => {
    setRecordConfigsLoading(true)
    try {
      const res = await safetyAPI.initializeConfigs()
      showToast(`${res.data.created} record types initialized`)
      fetchRecordConfigs()
    } catch (e) {
      showToast('Error initializing record types')
    } finally {
      setRecordConfigsLoading(false)
    }
  }

  const handleToggleConfig = async (id) => {
    try {
      await safetyAPI.toggleConfig(id)
      fetchRecordConfigs()
    } catch (e) {
      showToast('Error toggling record type')
    }
  }

  const handleConfigRoleChange = async (id, role) => {
    try {
      await safetyAPI.updateConfig(id, { assigned_role: role })
      fetchRecordConfigs()
    } catch (e) {
      showToast('Error updating role')
    }
  }

  // ── Integrations ──
  const handleConnect = async (service) => {
    try {
      let data = { ...connectForm }

      // GoMenu: separate account/password into config
      if (service === 'GOMENU') {
        data = {
          api_key: connectForm.api_key || '',
          config: {
            account: connectForm.account || '',
            password: connectForm.password || '',
          },
        }
      }

      await storeAPI.connectIntegration(service.toLowerCase(), data)
      showToast(`${INTEGRATION_INFO[service]?.name} connected`)
      setConnectingService(null)
      setConnectForm({})
      fetchIntegrations()
    } catch (e) {
      showToast('Connection failed: ' + (e.response?.data?.error || e.message))
    }
  }

  const handleDisconnect = async (service) => {
    if (!window.confirm(`Disconnect ${INTEGRATION_INFO[service]?.name}?`)) return
    try {
      await storeAPI.disconnectIntegration(service.toLowerCase())
      showToast(`${INTEGRATION_INFO[service]?.name} disconnected`)
      setSyncResult(null)
      fetchIntegrations()
    } catch (e) {
      showToast('Disconnect failed')
    }
  }

  const handleTestConnection = async (service) => {
    setTestingService(service)
    try {
      const res = await storeAPI.testIntegration(service.toLowerCase())
      showToast(res.data.message || 'Connection OK')
    } catch (e) {
      showToast('Test failed: ' + (e.response?.data?.error || e.message))
    } finally {
      setTestingService(null)
    }
  }

  const handleSync = async (service) => {
    setSyncingService(service)
    setSyncResult(null)
    try {
      const res = await storeAPI.syncIntegration(service.toLowerCase())
      setSyncResult(res.data)
      if (res.data.success) {
        showToast(res.data.message || 'Sync completed')
      } else {
        showToast(res.data.error || 'Sync failed')
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message
      setSyncResult({ success: false, error: msg })
      showToast('Sync failed: ' + msg)
    } finally {
      setSyncingService(null)
    }
  }

  // Group record configs by category
  const groupedConfigs = recordConfigs.reduce((acc, cfg) => {
    const cat = cfg.record_type_detail?.category || 'OTHER'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(cfg)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5'
  const btnPrimary = 'px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50'
  const btnSecondary = 'px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition'

  return (
    <div className="space-y-6">
      <PageHeader title="Store Settings" subtitle="Manage store configuration" icon={<SettingsIcon size={24} />} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <CheckCircleIcon size={16} />
          {toast}
        </div>
      )}

      {/* Placeholder Preview Modal */}
      {phModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Placeholder Preview</h3>
                <p className="text-xs text-gray-500 mt-0.5">{phModal.filename}</p>
              </div>
              <button onClick={() => setPhModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <XIcon size={18} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Known Placeholders */}
              {phModal.known.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-2">Known Placeholders ({phModal.known.length})</h4>
                  <div className="space-y-1">
                    {phModal.known.map(ph => (
                      <div key={ph.key} className="flex items-center gap-2 text-sm">
                        <span className="text-green-500">&#10003;</span>
                        <code className="px-1.5 py-0.5 bg-green-50 text-green-800 rounded text-xs font-mono">{`{{${ph.key}}}`}</code>
                        <span className="text-gray-500 text-xs">{ph.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unknown Placeholders */}
              {phModal.unknown.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-amber-700 mb-2">Unknown Placeholders ({phModal.unknown.length})</h4>
                  <p className="text-xs text-gray-500 mb-2">Map these to known placeholders or leave empty to keep as-is</p>
                  <div className="space-y-2">
                    {phModal.unknown.map(ph => (
                      <div key={ph.key} className="flex items-center gap-2">
                        <code className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded text-xs font-mono whitespace-nowrap">{`{{${ph.key}}}`}</code>
                        <span className="text-gray-400 text-xs">&rarr;</span>
                        <select
                          value={phModal.mappings[ph.key] || ''}
                          onChange={(e) => setPhModal(prev => ({
                            ...prev,
                            mappings: { ...prev.mappings, [ph.key]: e.target.value }
                          }))}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Keep as-is</option>
                          {phModal.known_keys.map(k => (
                            <option key={k} value={k}>{`{{${k}}}`}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {phModal.known.length === 0 && phModal.unknown.length === 0 && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No placeholders found in this document.
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setPhModal(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handlePhModalConfirm}
                disabled={docTemplateUploading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {docTemplateUploading ? 'Uploading...' : phModal.unknown.some(ph => phModal.mappings[ph.key]) ? 'Fix & Upload' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modules Tab ── */}
      {tab === 'modules' && (
        <Card className="p-6">
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Feature Modules</h3>
              <p className="text-xs text-gray-500 mt-0.5">Enable or disable features for your store. Disabled modules will be hidden from the sidebar and navigation.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_MODULES.map((mod) => {
                const isEnabled = enabledModules.includes(mod.key)
                return (
                  <div
                    key={mod.key}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition ${
                      isEnabled ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-gray-50/50'
                    }`}
                  >
                    <span className="text-2xl shrink-0">{mod.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{mod.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{mod.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleModule(mod.key)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-400">
                {enabledModules.length} of {ALL_MODULES.length} modules enabled
              </p>
              <button onClick={handleSaveModules} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Company Tab ── */}
      {tab === 'company' && (
        <Card className="p-6">
          <div className="space-y-6">
            {/* Logo */}
            <div>
              <label className={labelCls}>Logo</label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No logo</div>
                )}
                <label className={`${btnSecondary} cursor-pointer`}>
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Store Name</label>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>IRD Number</label>
                <input className={inputCls} value={form.ird_number} onChange={(e) => setForm({ ...form, ird_number: e.target.value })} placeholder="e.g. 12-345-678" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Address</label>
              <textarea className={inputCls} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Region (Anniversary Day)</label>
              <select className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                <option value="">Select region...</option>
                {NZ_REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Opening Time</label>
                <input className={inputCls} type="time" value={form.opening_time} onChange={(e) => setForm({ ...form, opening_time: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Closing Time</label>
                <input className={inputCls} type="time" value={form.closing_time} onChange={(e) => setForm({ ...form, closing_time: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handleSaveCompany} disabled={saving} className={btnPrimary}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Business Tab ── */}
      {tab === 'business' && (
        <Card className="p-6">
          <div className="space-y-8">
            {/* HR Cash Toggle */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">HR Cash</h3>
              <p className="text-xs text-gray-500 mb-3">Enable HR cash input section in Daily Closing</p>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hrCashEnabled}
                  onChange={(e) => setHrCashEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                <span className="ml-3 text-sm text-gray-700">{hrCashEnabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>

            {/* Otherwise Working Rule */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Otherwise Working Rule</h3>
              <p className="text-xs text-gray-500 mb-3">Public holiday entitlement: employee must have worked on that day in X out of last Y weeks</p>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Worked</span>
                <input
                  type="number"
                  min={1}
                  max={52}
                  className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={owThreshold}
                  onChange={(e) => setOwThreshold(Number(e.target.value))}
                />
                <span>out of last</span>
                <input
                  type="number"
                  min={1}
                  max={52}
                  className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={owWeeks}
                  onChange={(e) => setOwWeeks(Number(e.target.value))}
                />
                <span>weeks</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handleSaveBusiness} disabled={saving} className={btnPrimary}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Suppliers Tab ── */}
      {tab === 'suppliers' && (
        <Card>
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Suppliers</h3>
              <p className="text-xs text-gray-500">Suppliers automatically appear in Daily Closing</p>
            </div>
            <button
              onClick={() => setSupplierForm({ name: '', category: 'COGS', is_active: true })}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              <PlusIcon size={14} /> Add
            </button>
          </div>

          {/* Add/Edit Form */}
          {supplierForm && (
            <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
              <div className="space-y-3 mb-3">
                <input className={inputCls} placeholder="Supplier name" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} autoFocus />
                <select className={inputCls} value={supplierForm.category || 'COGS'} onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}>
                  <option value="COGS">COGS</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveSupplier} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">Save</button>
                <button onClick={() => setSupplierForm(null)} className="px-3 py-1.5 text-gray-500 text-xs font-medium hover:text-gray-700">Cancel</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No suppliers yet</td></tr>
                ) : suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        s.category === 'COGS' ? 'bg-blue-50 text-blue-700' :
                        s.category === 'MAINTENANCE' ? 'bg-orange-50 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{s.category_display || s.category}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSupplierForm({ ...s })}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(s.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Sales Tab ── */}
      {tab === 'sales' && (
        <Card>
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Sales Categories</h3>
              <p className="text-xs text-gray-500">Categories automatically appear in Daily Closing</p>
            </div>
            <button
              onClick={() => setCategoryForm({ name: '', is_active: true, sort_order: categories.length })}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              <PlusIcon size={14} /> Add
            </button>
          </div>

          {/* Add/Edit Form */}
          {categoryForm && (
            <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-3 mb-3">
                <input className={`${inputCls} flex-1`} placeholder="Category name (e.g. Dining, Uber Eats)" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} autoFocus />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveCategory} disabled={!categoryForm.name?.trim()} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40">Save</button>
                <button onClick={() => setCategoryForm(null)} className="px-3 py-1.5 text-gray-500 text-xs font-medium hover:text-gray-700">Cancel</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400 text-sm">No categories yet</td></tr>
                ) : categories.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={async () => {
                          try {
                            await storeAPI.updateSalesCategory(c.id, { is_active: !c.is_active })
                            fetchCategories()
                          } catch (e) { showToast('Error toggling status') }
                        }}
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full cursor-pointer transition ${c.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {c.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setCategoryForm({ ...c })}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(c.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── HR Setup Tab ── */}
      {tab === 'hr' && (
        <div className="space-y-6">
          {/* DOCX Placeholder Upload Tool */}
          <Card>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">DOCX Placeholder Upload Tool</h3>
              <p className="text-xs text-gray-500">Upload a .docx template, preview/fix placeholders, then save to a document type</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Placeholder Reference — click to copy */}
              <details className="group" open>
                <summary className="text-xs font-semibold text-blue-800 cursor-pointer select-none hover:text-blue-900">Placeholder Reference (click code to copy)</summary>
                <div className="mt-2 p-3 bg-blue-50 rounded-lg space-y-2">
                  <p className="text-[11px] font-semibold text-blue-800">Auto-fill placeholders:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['{{employee_name}}','{{employee_first_name}}','{{hourly_rate}}','{{holiday_rate}}','{{gross_rate}}','{{hours}}','{{job_title}}','{{position_title}}','{{work_type}}','{{start_date}}','{{commencement_date}}','{{work_location}}','{{min_hours}}','{{max_hours}}','{{reporting_to}}','{{company_name}}','{{company_address}}','{{company_phone}}','{{company_email}}','{{company_ird}}'].map(ph => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(ph); showToast(`Copied: ${ph}`) }}
                        className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-mono hover:bg-blue-200 active:bg-blue-300 cursor-pointer transition"
                        title="Click to copy"
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] font-semibold text-blue-800 mt-2">Signature markers:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['[[SIGNATURE]]','[[INITIALS]]','[[DATE]]'].map(ph => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(ph); showToast(`Copied: ${ph}`) }}
                        className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-mono hover:bg-orange-200 active:bg-orange-300 cursor-pointer transition"
                        title="Click to copy"
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-blue-600 mt-1">Click any code above to copy to clipboard, then paste into your Word document.</p>
                </div>
              </details>

              {/* File Upload */}
              <div>
                <label className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
                  <CameraIcon size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {docxTool.file ? docxTool.file.name : 'Choose .docx file to analyze...'}
                  </span>
                  <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files[0]) handleDocxToolUpload(e.target.files[0])
                    }}
                  />
                </label>
              </div>

              {docxTool.loading && (
                <div className="text-center py-3">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <p className="text-xs text-gray-500 mt-1">Analyzing placeholders...</p>
                </div>
              )}

              {/* Placeholder Results */}
              {docxTool.result && !docxTool.loading && (
                <div className="space-y-3">
                  {docxTool.result.known.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-green-700 mb-1">Known Placeholders ({docxTool.result.known.length})</h4>
                      <div className="space-y-0.5">
                        {docxTool.result.known.map(ph => (
                          <div key={ph.key} className="flex items-center gap-2 text-xs">
                            <span className="text-green-500">&#10003;</span>
                            <code className="px-1 bg-green-50 text-green-800 rounded font-mono">{`{{${ph.key}}}`}</code>
                            <span className="text-gray-500">{ph.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {docxTool.result.unknown.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-amber-700 mb-1">Unknown Placeholders ({docxTool.result.unknown.length})</h4>
                      <p className="text-[11px] text-gray-500 mb-1">Map these to known placeholders or leave as-is</p>
                      <div className="space-y-1.5">
                        {docxTool.result.unknown.map(ph => (
                          <div key={ph.key} className="flex items-center gap-2">
                            <code className="px-1 bg-amber-50 text-amber-800 rounded text-xs font-mono whitespace-nowrap">{`{{${ph.key}}}`}</code>
                            <span className="text-gray-400 text-xs">&rarr;</span>
                            <select
                              value={docxTool.mappings[ph.key] || ''}
                              onChange={(e) => setDocxTool(prev => ({
                                ...prev,
                                mappings: { ...prev.mappings, [ph.key]: e.target.value }
                              }))}
                              className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Keep as-is</option>
                              {docxTool.result.known_keys.map(k => (
                                <option key={k} value={k}>{`{{${k}}}`}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {docxTool.result.known.length === 0 && docxTool.result.unknown.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-2">No placeholders found in this document.</p>
                  )}

                  {/* Save Target */}
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-700">Save as:</h4>
                    <div className="flex items-center gap-4">
                      {[
                        { key: 'CONTRACT', label: 'Contract' },
                        { key: 'JOB_OFFER', label: 'Job Offer' },
                        { key: 'JOB_DESCRIPTION', label: 'Job Description' },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="docxSaveTarget"
                            checked={docxTool.saveTarget === key}
                            onChange={() => setDocxTool(prev => ({ ...prev, saveTarget: key }))}
                            className="text-blue-600"
                          />
                          {label}
                        </label>
                      ))}
                    </div>

                    {docxTool.saveTarget === 'CONTRACT' && (
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Work Type</label>
                        <select
                          value={docxTool.saveWorkType}
                          onChange={(e) => setDocxTool(prev => ({ ...prev, saveWorkType: e.target.value }))}
                          className={inputCls + ' max-w-xs'}
                        >
                          {[
                            { key: 'FULL_TIME', label: 'Full Time' },
                            { key: 'PART_TIME', label: 'Part Time' },
                            { key: 'CASUAL', label: 'Casual' },
                            { key: 'SALARY', label: 'Salary' },
                            { key: 'VISA_FULL_TIME', label: 'Visa Full Time' },
                          ].map(({ key, label }) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {docxTool.saveTarget === 'JOB_DESCRIPTION' && (
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Job Title</label>
                        <select
                          value={docxTool.saveJobTitle}
                          onChange={(e) => setDocxTool(prev => ({ ...prev, saveJobTitle: e.target.value }))}
                          className={inputCls + ' max-w-xs'}
                        >
                          <option value="">Select job title...</option>
                          {jobTitles.filter(j => j.is_active).map(j => (
                            <option key={j.id} value={j.code}>{j.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleDocxToolSave}
                      disabled={docTemplateUploading || (docxTool.saveTarget === 'JOB_DESCRIPTION' && !docxTool.saveJobTitle)}
                      className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {docTemplateUploading ? 'Uploading...' : Object.values(docxTool.mappings).some(v => v) ? 'Fix & Upload' : 'Upload'}
                    </button>
                    <button
                      onClick={handleDocxToolDownload}
                      className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition"
                    >
                      {Object.values(docxTool.mappings).some(v => v) ? 'Fix & Download' : 'Download'}
                    </button>
                    <button
                      onClick={() => setDocxTool({ file: null, result: null, loading: false, saveTarget: 'CONTRACT', saveWorkType: 'FULL_TIME', saveJobTitle: '', mappings: {} })}
                      className="px-4 py-2 text-gray-500 text-xs font-medium hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Contract Templates — per work type */}
          <Card>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Contract Templates</h3>
              <p className="text-xs text-gray-500">One contract template per employment type — auto-assigned during onboarding</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { key: 'FULL_TIME', label: 'Full Time' },
                { key: 'PART_TIME', label: 'Part Time' },
                { key: 'CASUAL', label: 'Casual' },
                { key: 'SALARY', label: 'Salary' },
                { key: 'VISA_FULL_TIME', label: 'Visa Full Time' },
              ].map(({ key, label }) => {
                const existing = docTemplates.find((t) => t.document_type === 'CONTRACT' && t.work_type === key)
                return (
                  <div key={key} className="flex flex-col p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <div className="flex items-center gap-1">
                        {existing && (
                          <button
                            onClick={() => handleDeleteDocTemplate(existing.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}
                        <label className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 cursor-pointer transition">
                          {existing ? 'Replace' : 'Upload'}
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            className="hidden"
                            disabled={docTemplateUploading}
                            onChange={(e) => {
                              if (e.target.files[0]) {
                                if (existing) handleDeleteDocTemplate(existing.id)
                                handleUploadDocTemplate('CONTRACT', e.target.files[0], { workType: key })
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    {existing ? (
                      <p className="text-xs text-green-600 truncate">{existing.title}</p>
                    ) : (
                      <p className="text-xs text-gray-400">No template</p>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Job Offer — single template */}
          <Card>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Job Offer Template</h3>
              <p className="text-xs text-gray-500">Single template used for all new hire job offers</p>
            </div>
            <div className="p-5">
              {(() => {
                const existing = docTemplates.find((t) => t.document_type === 'JOB_OFFER')
                return (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Job Offer</p>
                      {existing ? (
                        <p className="text-xs text-green-600 mt-0.5">{existing.title}</p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">No template uploaded</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {existing && (
                        <button
                          onClick={() => handleDeleteDocTemplate(existing.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <TrashIcon size={14} />
                        </button>
                      )}
                      <label className={`${btnSecondary} cursor-pointer text-xs`}>
                        {existing ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          disabled={docTemplateUploading}
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              if (existing) handleDeleteDocTemplate(existing.id)
                              handleUploadDocTemplate('JOB_OFFER', e.target.files[0])
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )
              })()}
            </div>
          </Card>

          {/* Job Descriptions — per job role (dynamic) */}
          <Card>
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Job Descriptions</h3>
                <p className="text-xs text-gray-500">Manage job titles and upload descriptions per role</p>
              </div>
              <button
                onClick={() => setJobTitleForm({ code: '', label: '', is_active: true, sort_order: jobTitles.length })}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                <PlusIcon size={14} /> Add Title
              </button>
            </div>

            {/* Add/Edit Job Title Form */}
            {jobTitleForm && (
              <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <input className={inputCls} placeholder="Code (e.g. BARISTA)" value={jobTitleForm.code} onChange={(e) => setJobTitleForm({ ...jobTitleForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })} />
                  <input className={inputCls} placeholder="Label (e.g. Barista)" value={jobTitleForm.label} onChange={(e) => setJobTitleForm({ ...jobTitleForm, label: e.target.value })} />
                  <input className={inputCls} type="number" placeholder="Order" value={jobTitleForm.sort_order} onChange={(e) => setJobTitleForm({ ...jobTitleForm, sort_order: Number(e.target.value) })} />
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={jobTitleForm.is_active} onChange={(e) => setJobTitleForm({ ...jobTitleForm, is_active: e.target.checked })} className="rounded" />
                    Active
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveJobTitle} disabled={!jobTitleForm.code || !jobTitleForm.label} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">Save</button>
                  <button onClick={() => setJobTitleForm(null)} className="px-3 py-1.5 text-gray-500 text-xs font-medium hover:text-gray-700">Cancel</button>
                </div>
              </div>
            )}

            <div className="p-5 space-y-2">
              {jobTitles.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">No job titles yet</p>
              ) : jobTitles.map((jt) => {
                const existing = docTemplates.find((t) => t.document_type === 'JOB_DESCRIPTION' && t.job_title === jt.code)
                return (
                  <div key={jt.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{jt.label}</p>
                        <span className="text-[10px] text-gray-400 font-mono">{jt.code}</span>
                        {!jt.is_active && (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-500">Inactive</span>
                        )}
                      </div>
                      {existing ? (
                        <p className="text-xs text-green-600 mt-0.5 truncate">{existing.title}</p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">No description</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={() => setJobTitleForm({ ...jt })}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <EditIcon size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteJobTitle(jt.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <TrashIcon size={14} />
                      </button>
                      {existing && (
                        <button
                          onClick={() => handleDeleteDocTemplate(existing.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete description"
                        >
                          <XIcon size={14} />
                        </button>
                      )}
                      <label className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 cursor-pointer transition">
                        {existing ? 'Replace' : 'Upload'}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          disabled={docTemplateUploading}
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              if (existing) handleDeleteDocTemplate(existing.id)
                              handleUploadDocTemplate('JOB_DESCRIPTION', e.target.files[0], { jobTitle: jt.code })
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Training Materials */}
          <Card>
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Training Materials</h3>
                <p className="text-xs text-gray-500">Upload training PDFs or add video links for onboarding</p>
              </div>
              <button
                onClick={() => setTrainingForm({ module_type: 'SAFETY', title: '', description: '', video_url: '', file_obj: null })}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                <PlusIcon size={14} /> Add
              </button>
            </div>

            {/* Add/Edit Form */}
            {trainingForm && (
              <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
                <div className="space-y-3 mb-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Type</label>
                      <select
                        className={inputCls}
                        value={trainingForm.module_type}
                        onChange={(e) => setTrainingForm({ ...trainingForm, module_type: e.target.value })}
                      >
                        {TRAINING_MODULE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Title</label>
                      <input
                        className={inputCls}
                        placeholder="e.g. Fire Safety Procedures"
                        value={trainingForm.title}
                        onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Video URL (optional)</label>
                    <input
                      className={inputCls}
                      placeholder="https://youtube.com/..."
                      value={trainingForm.video_url}
                      onChange={(e) => setTrainingForm({ ...trainingForm, video_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">PDF Material (optional)</label>
                    <label className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition">
                      <CameraIcon size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {trainingForm.file_obj ? trainingForm.file_obj.name : 'Choose file...'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => setTrainingForm({ ...trainingForm, file_obj: e.target.files[0] || null })}
                      />
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTraining}
                    disabled={!trainingForm.title}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={() => setTrainingForm(null)} className="px-3 py-1.5 text-gray-500 text-xs font-medium hover:text-gray-700">Cancel</button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="divide-y divide-gray-50">
              {trainingModules.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">No training modules yet</div>
              ) : trainingModules.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        m.module_type === 'SAFETY' ? 'bg-red-50 text-red-700' :
                        m.module_type === 'FCP' ? 'bg-blue-50 text-blue-700' :
                        m.module_type === 'HAZARD' ? 'bg-amber-50 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {m.module_type_display}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">{m.title}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {m.file && <span className="text-xs text-green-600">PDF attached</span>}
                      {m.video_url && <span className="text-xs text-blue-600">Video link</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() => setTrainingForm({
                        id: m.id, module_type: m.module_type, title: m.title,
                        description: m.description || '', video_url: m.video_url || '', file_obj: null
                      })}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <EditIcon size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTraining(m.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Food Safety Tab ── */}
      {tab === 'safety' && (
        <div className="space-y-6">
          {/* Temperature Locations */}
          <Card>
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Temperature Check Locations</h3>
                <p className="text-xs text-gray-500">Define locations for temperature monitoring (fridge, freezer, etc.)</p>
              </div>
              <button
                onClick={() => setTempForm({ name: '', standard_min: '', standard_max: '', is_active: true, sort_order: tempLocations.length })}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                <PlusIcon size={14} /> Add
              </button>
            </div>

            {/* Add/Edit Form */}
            {tempForm && (
              <div className="px-5 py-4 bg-blue-50 border-b border-blue-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <input className={inputCls} placeholder="Location name" value={tempForm.name} onChange={(e) => setTempForm({ ...tempForm, name: e.target.value })} />
                  <input className={inputCls} type="number" step="0.1" placeholder="Min °C" value={tempForm.standard_min} onChange={(e) => setTempForm({ ...tempForm, standard_min: e.target.value })} />
                  <input className={inputCls} type="number" step="0.1" placeholder="Max °C" value={tempForm.standard_max} onChange={(e) => setTempForm({ ...tempForm, standard_max: e.target.value })} />
                  <input className={inputCls} type="number" placeholder="Order" value={tempForm.sort_order} onChange={(e) => setTempForm({ ...tempForm, sort_order: Number(e.target.value) })} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveTempLocation} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">Save</button>
                  <button onClick={() => setTempForm(null)} className="px-3 py-1.5 text-gray-500 text-xs font-medium hover:text-gray-700">Cancel</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Min (°C)</th>
                    <th className="px-5 py-3">Max (°C)</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tempLocations.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No locations yet</td></tr>
                  ) : tempLocations.map((loc) => (
                    <tr key={loc.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{loc.name}</td>
                      <td className="px-5 py-3 text-gray-500">{loc.standard_min != null ? `${loc.standard_min}°` : '-'}</td>
                      <td className="px-5 py-3 text-gray-500">{loc.standard_max != null ? `${loc.standard_max}°` : '-'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${loc.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {loc.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setTempForm({ ...loc, standard_min: loc.standard_min ?? '', standard_max: loc.standard_max ?? '' })}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <EditIcon size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTempLocation(loc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Cleaning Areas */}
          <Card>
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Cleaning Areas</h3>
                <p className="text-xs text-gray-500">Define cleaning areas for daily cleaning records</p>
              </div>
              <button
                onClick={() => setCleaningAreaForm({ name: '', is_active: true, sort_order: cleaningAreas.length })}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition"
              >
                <PlusIcon size={14} /> Add
              </button>
            </div>

            {/* Add/Edit Form */}
            {cleaningAreaForm && (
              <div className="px-5 py-4 bg-green-50 border-b border-green-100">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  <input className={inputCls} placeholder="Area name" value={cleaningAreaForm.name} onChange={(e) => setCleaningAreaForm({ ...cleaningAreaForm, name: e.target.value })} />
                  <input className={inputCls} type="number" placeholder="Order" value={cleaningAreaForm.sort_order} onChange={(e) => setCleaningAreaForm({ ...cleaningAreaForm, sort_order: Number(e.target.value) })} />
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={cleaningAreaForm.is_active} onChange={(e) => setCleaningAreaForm({ ...cleaningAreaForm, is_active: e.target.checked })} className="rounded" />
                    Active
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveCleaningArea} className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">Save</button>
                  <button onClick={() => setCleaningAreaForm(null)} className="px-3 py-1.5 text-gray-500 text-xs font-medium hover:text-gray-700">Cancel</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-5 py-3">Area Name</th>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cleaningAreas.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No cleaning areas yet</td></tr>
                  ) : cleaningAreas.map((area) => (
                    <tr key={area.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{area.name}</td>
                      <td className="px-5 py-3 text-gray-500">{area.sort_order}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${area.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {area.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setCleaningAreaForm({ ...area })}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <EditIcon size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteCleaningArea(area.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* MPI Record Types */}
          <Card>
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">MPI Record Types</h3>
                <p className="text-xs text-gray-500">NZ MPI food safety record types — toggle on/off per store</p>
              </div>
              {recordConfigs.length === 0 && (
                <button
                  onClick={handleInitializeConfigs}
                  disabled={recordConfigsLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {recordConfigsLoading ? 'Setting up...' : 'Initialize'}
                </button>
              )}
            </div>

            {recordConfigs.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                No record types configured. Click "Initialize" to set up MPI record types.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {[
                  { key: 'DAILY', label: 'Daily', emoji: '📋' },
                  { key: 'WEEKLY', label: 'Weekly', emoji: '📅' },
                  { key: 'MONTHLY', label: 'Monthly', emoji: '📆' },
                  { key: 'EVENT', label: 'Event-based', emoji: '⚠️' },
                  { key: 'SETUP', label: 'Setup / Reference', emoji: '📌' },
                  { key: 'SPECIALIST', label: 'Specialist', emoji: '🔬' },
                ].map(({ key, label, emoji }) => {
                  const configs = groupedConfigs[key] || []
                  if (configs.length === 0) return null

                  const isSpecialist = key === 'SPECIALIST'
                  const showList = isSpecialist ? specialistOpen : true

                  return (
                    <div key={key} className="px-5 py-3">
                      <button
                        onClick={() => isSpecialist && setSpecialistOpen(!specialistOpen)}
                        className={`flex items-center gap-2 mb-2 w-full text-left ${isSpecialist ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <span className="text-sm">{emoji}</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
                        <span className="text-xs text-gray-400">({configs.length})</span>
                        {isSpecialist && (
                          <span className="text-xs text-gray-400 ml-auto">{specialistOpen ? '▲' : '▼'}</span>
                        )}
                      </button>

                      {showList && (
                        <div className="space-y-1.5">
                          {configs.map((cfg) => {
                            const rt = cfg.record_type_detail
                            return (
                              <div
                                key={cfg.id}
                                className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                                  cfg.is_enabled ? 'bg-blue-50/50' : 'bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  {/* Toggle */}
                                  <button
                                    onClick={() => handleToggleConfig(cfg.id)}
                                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                                      cfg.is_enabled ? 'bg-blue-600' : 'bg-gray-300'
                                    }`}
                                  >
                                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                      cfg.is_enabled ? 'translate-x-4' : 'translate-x-0.5'
                                    }`} />
                                  </button>
                                  <div className="min-w-0">
                                    <p className={`text-sm truncate ${cfg.is_enabled ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                                      {rt?.name || 'Unknown'}
                                    </p>
                                    {rt?.name_ko && (
                                      <p className="text-xs text-gray-400 truncate">{rt.name_ko}</p>
                                    )}
                                  </div>
                                </div>

                                {/* Role selector */}
                                {cfg.is_enabled && (
                                  <select
                                    value={cfg.assigned_role}
                                    onChange={(e) => handleConfigRoleChange(cfg.id, e.target.value)}
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 ml-2"
                                  >
                                    <option value="EMPLOYEE">Employee</option>
                                    <option value="MANAGER">Manager</option>
                                    <option value="BOTH">Both</option>
                                  </select>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Checklist Templates */}
          <Card>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Checklist Templates</h3>
              <p className="text-xs text-gray-500">Safety checklists for daily operations</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Stage</th>
                    <th className="px-5 py-3">Items</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No templates yet</td></tr>
                  ) : templates.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-5 py-3 text-gray-500 capitalize">{t.stage}</td>
                      <td className="px-5 py-3 text-gray-500">{Array.isArray(t.items) ? t.items.length : 0}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${t.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Integrations Tab ── */}
      {tab === 'integrations' && (
        <div className="space-y-6">
          <Card>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Third-Party Integrations</h3>
              <p className="text-xs text-gray-500">Connect your POS and accounting systems</p>
            </div>
          </Card>

          {['GOMENU', 'LIGHTSPEED', 'XERO'].map((serviceKey) => {
            const info = INTEGRATION_INFO[serviceKey]
            const integration = integrations.find((i) => i.service === serviceKey)
            const isConnected = integration?.is_connected
            const isExpanded = connectingService === serviceKey
            const colorMap = { orange: 'orange', blue: 'blue', green: 'green' }
            const c = colorMap[info.color] || 'gray'
            const isSyncing = syncingService === serviceKey

            return (
              <Card key={serviceKey}>
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-${c}-50 flex items-center justify-center text-2xl`}>
                        {info.icon}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{info.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{info.description}</p>
                        {isConnected && integration.connected_at && (
                          <p className="text-xs text-gray-400 mt-1">
                            Connected {new Date(integration.connected_at).toLocaleDateString('en-NZ')}
                            {integration.connected_by_name && ` by ${integration.connected_by_name}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-green-50 text-green-700 rounded-full">
                            <CheckCircleIcon size={12} /> Connected
                          </span>
                          {info.syncable && (
                            <button
                              onClick={() => handleSync(serviceKey)}
                              disabled={isSyncing}
                              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                            >
                              {isSyncing ? 'Syncing...' : 'Sync Now'}
                            </button>
                          )}
                          <button
                            onClick={() => handleTestConnection(serviceKey)}
                            disabled={testingService === serviceKey}
                            className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                          >
                            {testingService === serviceKey ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            onClick={() => handleDisconnect(serviceKey)}
                            className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setConnectingService(isExpanded ? null : serviceKey)
                            setConnectForm({})
                          }}
                          className={`px-4 py-1.5 text-xs font-medium rounded-lg transition ${
                            isExpanded
                              ? 'bg-gray-100 text-gray-600'
                              : `bg-${c}-600 text-white hover:bg-${c}-700`
                          }`}
                        >
                          {isExpanded ? 'Cancel' : 'Connect'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sync Result */}
                  {isConnected && info.syncable && syncResult && (
                    <div className={`mt-4 p-3 rounded-lg text-sm ${
                      syncResult.success
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      <div className="font-medium mb-1">
                        {syncResult.success ? 'Sync Completed' : 'Sync Failed'}
                      </div>
                      <p className="text-xs">
                        {syncResult.success
                          ? syncResult.message
                          : (syncResult.error || 'Unknown error')}
                      </p>
                      {syncResult.success && syncResult.pos_total && (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Card: </span>
                            <span className="font-semibold">${syncResult.pos_card}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Cash: </span>
                            <span className="font-semibold">${syncResult.pos_cash}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total: </span>
                            <span className="font-semibold">${syncResult.pos_total}</span>
                          </div>
                        </div>
                      )}
                      {syncResult.success && syncResult.store_name && (
                        <p className="text-xs text-gray-500 mt-1">
                          Store: {syncResult.store_name} | Date: {syncResult.date}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Connect Form */}
                  {isExpanded && !isConnected && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {info.fields.map((field) => (
                          <div key={field.key}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                            <input
                              type={field.type}
                              value={connectForm[field.key] || ''}
                              onChange={(e) => setConnectForm({ ...connectForm, [field.key]: e.target.value })}
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => handleConnect(serviceKey)}
                          className={`px-4 py-2 text-sm font-medium bg-${c}-600 text-white rounded-lg hover:bg-${c}-700 transition`}
                        >
                          Connect {info.name}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'import' && (
        <ImportDataTab storeId={selectedStore?.id} />
      )}
    </div>
  )
}

function ImportDataTab({ storeId }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const handleDownloadTemplate = async () => {
    setDownloading(true)
    try {
      const params = storeId ? { store_id: storeId } : {}
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
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const params = storeId ? { store_id: storeId } : {}
      const res = await storeAPI.importData(formData, params)
      setResult(res.data)
      setFile(null)
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Import Monthly Report</h3>
          <p className="text-xs text-gray-500">Upload Excel file with historical Sales & COGs data</p>
        </div>
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
                  {downloading ? (
                    <><span className="animate-spin">&#9696;</span> Generating...</>
                  ) : (
                    <><span>&#128196;</span> Download Template</>
                  )}
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
                      accept=".xlsx,.xls"
                      onChange={(e) => setFile(e.target.files[0])}
                      className="hidden"
                    />
                    <div className="w-full px-4 py-3 border-2 border-dashed border-emerald-300 rounded-lg text-center cursor-pointer hover:border-emerald-500 transition">
                      {file ? (
                        <p className="text-sm font-medium text-emerald-800">{file.name}</p>
                      ) : (
                        <p className="text-sm text-emerald-600">Click to select Excel file (.xlsx)</p>
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
                  <p className="text-2xl font-bold text-amber-700">{result.closings_updated}</p>
                  <p className="text-[10px] text-amber-500 uppercase">Days Updated</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">
                    {result.other_sales_created + result.supplier_costs_created}
                  </p>
                  <p className="text-[10px] text-purple-500 uppercase">Records</p>
                </div>
              </div>
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
