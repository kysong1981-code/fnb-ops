import { useAuth } from '../../context/AuthContext'
import { BellIcon } from '../icons'

export default function EmployeeHeader() {
  const { user } = useAuth()

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const firstName = user?.user?.first_name || user?.user?.username || ''
  const initials = firstName.charAt(0).toUpperCase()

  return (
    <header className="bg-white px-5 pt-4 pb-3 shrink-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">{getGreeting()} 👋</p>
          <p className="text-lg font-bold text-gray-900">{firstName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition">
            <BellIcon size={18} className="text-gray-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
