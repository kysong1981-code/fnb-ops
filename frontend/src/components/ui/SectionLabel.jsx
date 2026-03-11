export default function SectionLabel({ children, className = '' }) {
  return (
    <h3 className={`text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 ${className}`}>
      {children}
    </h3>
  )
}
