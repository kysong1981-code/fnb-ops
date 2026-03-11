import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from './AuthContext'

const StoreContext = createContext()

const ALL_STORES_OPTION = { id: 'all', name: 'All Stores', level: 'HQ' }

export function StoreProvider({ children }) {
  const { user, token } = useAuth()
  const [stores, setStores] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [loading, setLoading] = useState(false)

  const isCeoOrHq = ['CEO', 'HQ'].includes(user?.role)

  useEffect(() => {
    if (token && user) {
      fetchStores()
    }
  }, [token, user])

  // Restore selected store from localStorage
  useEffect(() => {
    if (stores.length > 0) {
      const savedId = localStorage.getItem('selected_store_id')

      // Restore "All Stores" selection for CEO/HQ
      if (savedId === 'all' && isCeoOrHq) {
        setSelectedStore(ALL_STORES_OPTION)
        return
      }

      const found = stores.find(s => String(s.id) === savedId)
      if (found) {
        setSelectedStore(found)
      } else {
        // Default: user's own org or first store
        const userOrg = stores.find(s => s.id === user?.organization_detail?.id)
        setSelectedStore(userOrg || stores[0])
      }
    }
  }, [stores])

  const fetchStores = async () => {
    setLoading(true)
    try {
      const res = await api.get('/users/stores/')
      const data = res.data?.results || res.data
      setStores(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch stores:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectStore = (store) => {
    setSelectedStore(store)
    localStorage.setItem('selected_store_id', String(store.id))
    // 스토어 변경 시 페이지 새로고침하여 새 스토어 데이터 로드
    window.location.reload()
  }

  // For CEO/HQ: check if "All Stores" is currently selected
  const isAllStores = selectedStore?.id === 'all'

  return (
    <StoreContext.Provider value={{ stores, selectedStore, selectStore, loading, isAllStores, allStoresOption: isCeoOrHq ? ALL_STORES_OPTION : null }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStore must be used within StoreProvider')
  }
  return context
}
