import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import api from '../api/client'

interface AuthCtx {
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('autocrm_token'))

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password })
    const t: string = res.data.access_token
    localStorage.setItem('autocrm_token', t)
    setToken(t)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('autocrm_token')
    setToken(null)
  }, [])

  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
