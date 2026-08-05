import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { Lock, Heart } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const password = (data.get('password') as string ?? '').trim()
    setError('')
    setLoading(true)
    try {
      await login(password)
    } catch {
      setError('Contraseña incorrecta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Heart size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Agente Médico</h1>
          <p className="text-blue-300 text-sm">Análisis inteligente de estudios clínicos</p>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/10 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-blue-200 mb-1.5">Contraseña de acceso</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" />
                <input
                  type="password"
                  name="password"
                  defaultValue=""
                  required
                  autoFocus
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-300 text-sm font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-lg"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-blue-400 mt-6">Acceso privado y seguro</p>
      </div>
    </div>
  )
}
