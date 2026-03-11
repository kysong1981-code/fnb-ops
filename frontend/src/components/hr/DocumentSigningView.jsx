import { useRef, useState, useEffect, useCallback } from 'react'
import { hrAPI } from '../../services/api'

/* ─── Small Drawing Canvas popup ─── */
function MiniCanvas({ width = 280, height = 80, onDone, onCancel }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = width * dpr
    c.height = height * dpr
    const ctx = c.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1a1a1a'
  }, [width, height])

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    const t = e.touches ? e.touches[0] : e
    return { x: t.clientX - r.left, y: t.clientY - r.top }
  }

  const start = (e) => {
    e.preventDefault(); e.stopPropagation()
    const ctx = canvasRef.current.getContext('2d')
    const p = pos(e)
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
    setDrawing(true)
  }
  const move = (e) => {
    if (!drawing) return
    e.preventDefault(); e.stopPropagation()
    const ctx = canvasRef.current.getContext('2d')
    const p = pos(e)
    ctx.lineTo(p.x, p.y); ctx.stroke()
    setHasContent(true)
  }
  const stop = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    setDrawing(false)
  }
  const clear = () => {
    const c = canvasRef.current; const ctx = c.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, c.width / dpr, c.height / dpr)
    setHasContent(false)
  }
  const done = () => { if (hasContent) onDone(canvasRef.current.toDataURL('image/png')) }

  return (
    <div className="bg-white rounded-xl shadow-2xl border-2 border-blue-300 p-3 space-y-2" onClick={e => e.stopPropagation()}>
      <p className="text-[11px] font-semibold text-gray-600 text-center">Draw below, then click Done</p>
      <canvas ref={canvasRef} style={{ width, height }}
        className="border border-gray-200 rounded-lg cursor-crosshair touch-none bg-white"
        onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
      />
      <div className="flex justify-between items-center">
        <button onClick={clear} className="text-[11px] text-gray-500 hover:text-gray-700">Clear</button>
        <div className="flex gap-2">
          {onCancel && <button onClick={onCancel} className="px-3 py-1 text-[11px] text-gray-500 hover:text-gray-700">Cancel</button>}
          <button onClick={done} disabled={!hasContent}
            className="px-4 py-1.5 text-[11px] font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Clickable zone on PDF page ─── */
function SignZone({ type, label, icon, value, onClick, style }) {
  if (value) {
    return (
      <div style={style} onClick={onClick}
        className="absolute flex items-center justify-center rounded border-2 border-green-400 bg-green-50/50 cursor-pointer hover:border-green-500 hover:shadow-md transition-all">
        <img src={value} alt={label} className="max-h-full max-w-full object-contain p-0.5" />
      </div>
    )
  }
  const colors = type === 'signature' ? 'border-blue-400 bg-blue-50/80 hover:bg-blue-100/90 hover:border-blue-500'
    : type === 'initials' ? 'border-orange-400 bg-orange-50/80 hover:bg-orange-100/90 hover:border-orange-500'
    : 'border-purple-400 bg-purple-50/80'

  return (
    <div style={style} onClick={onClick}
      className={`absolute flex flex-col items-center justify-center cursor-pointer border-2 border-dashed rounded-lg transition-all hover:shadow-lg ${colors}`}>
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[9px] font-semibold text-gray-600 select-none mt-0.5">{label}</span>
    </div>
  )
}

/* ─── Main: Document Signing View ─── */
export default function DocumentSigningView({ docId, taskId, docTitle, onComplete, onCancel }) {
  const [pages, setPages] = useState([])
  const [signZones, setSignZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [signatureImg, setSignatureImg] = useState(null)
  const [initialsImg, setInitialsImg] = useState(null)
  const [dateValue] = useState(
    new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
  )
  const [activePopup, setActivePopup] = useState(null) // { type, pageIdx, zoneIdx }

  // Load PDF pages + zone data from backend
  useEffect(() => {
    let cancelled = false
    const loadPages = async () => {
      try {
        setLoading(true)
        const res = await hrAPI.documentPages(docId)
        if (!cancelled) {
          setPages(res.data.pages || [])
          setSignZones(res.data.sign_zones || [])
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load document')
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadPages()
    return () => { cancelled = true }
  }, [docId])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await hrAPI.signDocument(docId, { signature: signatureImg, initials: initialsImg })
      await hrAPI.completeOnboardingTask(taskId)
      onComplete?.()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to sign document')
    } finally {
      setSaving(false)
    }
  }

  // Check what types are needed
  const needsSignature = signZones.some(z => z.type === 'signature')
  const needsInitials = signZones.some(z => z.type === 'initials')
  const allSigned =
    (!needsSignature || !!signatureImg) &&
    (!needsInitials || !!initialsImg)

  const totalPages = pages.length

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900/80 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-700 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-gray-800">{docTitle || 'Sign Document'}</h2>
          <p className="text-[11px] text-gray-500">Click the highlighted areas on the document to sign</p>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          {needsInitials && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
              initialsImg ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'
            }`}>{initialsImg ? '✓' : '①'} Initials</span>
          )}
          {needsSignature && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
              signatureImg ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'
            }`}>{signatureImg ? '✓' : '②'} Signature</span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">✓ Date</span>
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
          <button onClick={handleSave} disabled={!allSigned || saving}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
            {saving ? 'Saving...' : '✓ Complete Signing'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-600">{error}</div>}

      {/* Document Pages */}
      <div className="flex-1 overflow-y-auto px-4 py-6" onClick={() => setActivePopup(null)}>
        <div className="max-w-[800px] mx-auto space-y-6">
          {pages.map((page, idx) => {
            const maxW = 800
            const ratio = page.width / page.height
            const displayW = Math.min(maxW, page.width / (window.devicePixelRatio || 1))

            // Get zones for this page
            const pageZones = signZones.filter(z => z.page === idx)

            return (
              <div key={idx} className="relative mx-auto bg-white shadow-xl rounded-lg overflow-visible"
                style={{ width: displayW, maxWidth: '100%' }}>
                <img src={page.image} alt={`Page ${idx + 1}`} className="w-full h-auto" draggable={false} />

                <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                  Page {idx + 1} / {totalPages}
                </div>

                {/* Dynamic sign zones from API */}
                {pageZones.map((zone, zi) => {
                  if (zone.type === 'date') {
                    return (
                      <div key={zi} style={{
                        position: 'absolute',
                        left: `${zone.x}%`, top: `${zone.y}%`,
                        width: `${zone.width}%`, height: `${zone.height}%`,
                        minHeight: 28,
                      }}
                        className="flex items-center justify-center border-2 border-purple-300 bg-purple-50/80 rounded-lg">
                        <div className="text-center">
                          <span className="text-[8px] text-purple-400 block leading-none">Date</span>
                          <span className="text-[11px] font-semibold text-purple-700">{dateValue}</span>
                        </div>
                      </div>
                    )
                  }

                  const isSignature = zone.type === 'signature'
                  const value = isSignature ? signatureImg : initialsImg
                  const icon = isSignature ? '🖊️' : '✍️'
                  const label = isSignature ? 'Sign here' : 'Initial here'

                  return (
                    <SignZone key={zi} type={zone.type} icon={icon} label={label} value={value}
                      style={{
                        position: 'absolute',
                        left: `${zone.x}%`, top: `${zone.y}%`,
                        width: `${zone.width}%`, height: `${zone.height}%`,
                        minHeight: isSignature ? 40 : 32,
                        minWidth: isSignature ? 120 : 60,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setActivePopup({ type: zone.type, pageIdx: idx, zoneIdx: zi })
                      }}
                    />
                  )
                })}

                {/* Drawing popup */}
                {activePopup?.pageIdx === idx && activePopup.type !== 'date' && (
                  <div className="absolute z-20" style={{
                    left: activePopup.type === 'signature' ? '5%' : 'auto',
                    right: activePopup.type === 'initials' ? '3%' : 'auto',
                    top: `${Math.max(0, (signZones.find(z => z.page === idx && z.type === activePopup.type)?.y || 50) - 20)}%`,
                  }}>
                    <MiniCanvas
                      width={activePopup.type === 'signature' ? 320 : 200}
                      height={activePopup.type === 'signature' ? 100 : 60}
                      onDone={(dataUrl) => {
                        if (activePopup.type === 'signature') setSignatureImg(dataUrl)
                        else setInitialsImg(dataUrl)
                        setActivePopup(null)
                      }}
                      onCancel={() => setActivePopup(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
          <div className="h-8" />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-white border-t px-4 py-2.5 flex items-center justify-between shrink-0">
        <p className="text-[11px] text-gray-500">
          {allSigned ? '✅ All fields completed — click Complete Signing' : 'Click the highlighted areas on the document to sign'}
        </p>
        <button onClick={handleSave} disabled={!allSigned || saving}
          className="px-5 py-2 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
          {saving ? 'Saving...' : '✓ Complete Signing'}
        </button>
      </div>
    </div>
  )
}
