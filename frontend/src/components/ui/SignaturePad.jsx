import { useRef, useState, useEffect, useCallback } from 'react'

function DrawingCanvas({ label, height = 160, onDataChange }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1a1a1a'
  }, [])

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    if (e.touches) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const startDrawing = useCallback((e) => {
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
  }, [getPos])

  const draw = useCallback((e) => {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    if (!hasContent) {
      setHasContent(true)
      onDataChange?.(canvasRef.current.toDataURL('image/png'))
    }
  }, [isDrawing, getPos, hasContent, onDataChange])

  const stopDrawing = useCallback((e) => {
    if (e) e.preventDefault()
    if (isDrawing && hasContent) {
      onDataChange?.(canvasRef.current.toDataURL('image/png'))
    }
    setIsDrawing(false)
  }, [isDrawing, hasContent, onDataChange])

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    setHasContent(false)
    onDataChange?.(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <button
          type="button"
          onClick={handleClear}
          className="px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition"
        >
          Clear
        </button>
      </div>
      <div className="border-2 border-dashed border-gray-300 rounded-xl bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  )
}

export default function SignaturePad({ onSave, onCancel }) {
  const [signatureData, setSignatureData] = useState(null)
  const [initialsData, setInitialsData] = useState(null)

  const handleSave = () => {
    if (!signatureData || !initialsData) return
    onSave({ signature: signatureData, initials: initialsData })
  }

  return (
    <div className="space-y-4">
      <DrawingCanvas
        label="✍️ Sign here (signature for last page)"
        height={140}
        onDataChange={setSignatureData}
      />

      <DrawingCanvas
        label="📝 Write your initials (stamped on every page)"
        height={80}
        onDataChange={setInitialsData}
      />

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!signatureData || !initialsData}
          className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Confirm Signature
        </button>
      </div>
    </div>
  )
}
