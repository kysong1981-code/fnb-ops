const variants = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  neutral: 'bg-gray-100 text-gray-600',
  purple: 'bg-violet-100 text-violet-700',
}

export default function Badge({ children, variant = 'neutral', dot, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant] || variants.neutral} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot === true ? 'bg-current' : dot}`} />}
      {children}
    </span>
  )
}
