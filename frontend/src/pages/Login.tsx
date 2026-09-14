import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Eye, EyeOff, ArrowRight, Bot, ShoppingBag, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import LogoIndseg from '../components/LogoIndseg'
import { externalNextPage, openExternalPage } from '../utils/nextPage'

const benefits = [
  { icon: Bot,         text: 'Bot WhatsApp activo 24/7' },
  { icon: ShoppingBag, text: 'Ventas ML en tiempo real' },
  { icon: Users,       text: 'CRM Kommo integrado' },
  { icon: CheckCircle, text: 'Métricas y alertas automáticas' },
]

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Read directly from DOM so browser autofill values are captured
    const data = new FormData(e.currentTarget)
    const username = (data.get('username') as string ?? '').trim()
    const password = (data.get('password') as string ?? '').trim()
    setError('')
    setLoading(true)
    try {
      // Read ?next= before logging in: once the token is set, LoginGuard
      // re-renders and redirects, which drops the query string.
      const next = externalNextPage()
      await login(username, password)
      if (next) openExternalPage(next)
      else navigate('/dashboard')
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex font-sans">

      {/* ── Left brand panel ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none" />

        {/* logo */}
        <div className="relative z-10">
          <LogoIndseg variant="full" iconSize={40} light />
        </div>

        {/* main copy */}
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-4 tracking-tight">
            Gestioná tu negocio{' '}
            <span className="italic text-brand-accent">desde un solo lugar</span>
          </h2>
          <p className="text-slate-400 text-sm mb-10 leading-relaxed">
            WhatsApp, Mercado Libre y Kommo CRM integrados. Leads automáticos, ventas en tiempo real.
          </p>
          <div className="space-y-3">
            {benefits.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center shrink-0">
                  <Icon size={13} className="text-brand-accent" />
                </div>
                <span className="text-sm text-slate-300 font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* bottom */}
        <p className="text-xs text-slate-600 relative z-10">panel.indumentariasegura.com.ar</p>
      </div>

      {/* ── Right form panel ──────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">

          {/* mobile logo */}
          <div className="mb-8 lg:hidden">
            <LogoIndseg variant="compact" iconSize={30} />
          </div>

          <h1 className="text-2xl font-black text-slate-800 mb-1">Bienvenido</h1>
          <p className="text-sm text-slate-500 mb-8">Ingresá tus credenciales para acceder al panel.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Usuario</label>
              <input
                type="text"
                name="username"
                defaultValue=""
                placeholder="admin"
                required
                autoFocus
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 focus:border-brand-accent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  name="password"
                  defaultValue=""
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 focus:border-brand-accent transition-all pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-accent hover:bg-brand-mid disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all shadow-glow text-sm"
            >
              {loading ? 'Ingresando...' : <>Ingresar <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-8">
            ¿Problemas para acceder? Contactá al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  )
}
