import { useNavigate } from 'react-router-dom'
import { MessageCircle, ShoppingBag, Users, BarChart3, Bot, ArrowRight, CheckCircle } from 'lucide-react'
import LogoIndseg from '../components/LogoIndseg'

const features = [
  {
    icon: Bot,
    title: 'Bot WhatsApp Automático',
    desc: 'Responde consultas, envía el menú de productos y crea leads en Kommo en segundos. Sin intervención manual.',
  },
  {
    icon: ShoppingBag,
    title: 'Ventas Mercado Libre',
    desc: 'Sincroniza órdenes del día, responde preguntas con IA y optimiza tus publicaciones automáticamente.',
  },
  {
    icon: Users,
    title: 'CRM Kommo Integrado',
    desc: 'Los leads se crean, etiquetan y mueven de etapa solos según el canal de origen y la interacción.',
  },
  {
    icon: BarChart3,
    title: 'Panel de Control',
    desc: 'Métricas de ventas del mes, reclamos, reputación y estado de todas las integraciones en tiempo real.',
  },
]

const integrations = [
  { name: 'WhatsApp', color: '#25D366', letter: 'W' },
  { name: 'Mercado Libre', color: '#FFE600', letter: 'ML', dark: true },
  { name: 'Kommo CRM', color: '#3B82F6', letter: 'K' },
  { name: 'Claude IA', color: '#D97706', letter: 'AI' },
]

// Mini dashboard mockup used in hero
function DashboardMock() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
        {/* top bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-white/10">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs text-slate-400 ml-2">panel.indumentariasegura.com.ar</span>
        </div>
        <div className="flex">
          {/* sidebar mock */}
          <div className="w-12 bg-slate-800 border-r border-white/10 py-4 flex flex-col items-center gap-3">
            {[BarChart3, BarChart3, ShoppingBag, MessageCircle].map((Icon, i) => (
              <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-brand-accent' : 'bg-slate-700'}`}>
                <Icon size={13} className="text-white" />
              </div>
            ))}
          </div>
          {/* content mock */}
          <div className="flex-1 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {['Ventas ML Mes', 'Leads Activos', 'WhatsApp', 'Reclamos'].map((label, i) => (
                <div key={label} className="bg-slate-800 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${i === 0 ? 'text-brand-accent' : 'text-white'}`}>
                    {['$2.1M', '47', '✓ Online', '1.2%'][i]}
                  </p>
                </div>
              ))}
            </div>
            <div className="bg-slate-800 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] text-slate-500 mb-2">Actividad reciente</p>
              {['Nuevo lead WhatsApp — Mayorista', 'ML Pregunta — Pantalón cargo', 'Venta cerrada — $15.400'].map((t, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-accent shrink-0" />
                  <span className="text-[10px] text-slate-400 truncate">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* glow */}
      <div className="absolute inset-0 rounded-2xl bg-brand-accent/5 blur-2xl -z-10 scale-105" />
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <LogoIndseg variant="icon" iconSize={130} light />
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 bg-brand-accent hover:bg-brand-mid text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-150 shadow-glow"
          >
            Acceder al panel <ArrowRight size={15} />
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-brand-accent/10 border border-brand-accent/20 text-brand-light text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
              Indumentaria Segura SRL
            </div>
            <h1 className="text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              Automatizá tu CRM.{' '}
              <span className="italic text-brand-accent">Sin esfuerzo.</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
              Gestioná leads de WhatsApp y Mercado Libre, sincronizá Kommo y controlá tus ventas — todo desde un solo panel.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 bg-brand-accent hover:bg-brand-mid text-white font-bold px-6 py-3.5 rounded-xl transition-all duration-150 shadow-glow text-base"
              >
                Acceder al Panel <ArrowRight size={17} />
              </button>
            </div>
            <div className="mt-8 flex flex-col gap-2">
              {['Bot WhatsApp activo 24/7', 'Sincronización automática con ML', 'Leads en Kommo sin intervención manual'].map(t => (
                <div key={t} className="flex items-center gap-2 text-sm text-slate-400">
                  <CheckCircle size={15} className="text-brand-accent shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </div>
          <DashboardMock />
        </div>
      </section>

      {/* ── Integrations strip ─────────────────────────── */}
      <section className="py-10 border-y border-white/5 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-center text-xs text-slate-500 uppercase tracking-widest font-semibold mb-6">Integrado con</p>
          <div className="flex flex-wrap justify-center gap-8">
            {integrations.map(({ name, color, letter, dark }) => (
              <div key={name} className="flex items-center gap-2.5 opacity-70 hover:opacity-100 transition-opacity">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                  style={{ background: color, color: dark ? '#1a1a1a' : 'white' }}
                >
                  {letter}
                </div>
                <span className="text-sm font-medium text-slate-300">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand-accent text-xs font-bold uppercase tracking-widest mb-3">Funcionalidades</p>
            <h2 className="text-4xl font-black tracking-tight">
              Todo lo que necesitás{' '}
              <span className="italic text-slate-400">en un lugar</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-slate-900 border border-white/5 rounded-2xl p-6 hover:border-brand-accent/30 hover:bg-slate-800/60 transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center mb-4 group-hover:bg-brand-accent/20 transition-colors">
                  <Icon size={18} className="text-brand-accent" />
                </div>
                <h3 className="font-bold text-white text-sm mb-2 leading-snug">{title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ─────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-brand-accent/10 to-brand-mid/5 border border-brand-accent/20 rounded-3xl p-12">
            <h2 className="text-4xl font-black tracking-tight mb-4">
              Tu CRM, corriendo{' '}
              <span className="italic text-brand-accent">solo</span>
            </h2>
            <p className="text-slate-400 mb-8">Ingresá al panel y controlá todo desde un lugar.</p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 bg-brand-accent hover:bg-brand-mid text-white font-bold px-8 py-4 rounded-xl transition-all text-base shadow-glow"
            >
              Acceder al Panel <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <LogoIndseg variant="compact" iconSize={36} light />
          <p className="text-xs text-slate-600">© 2026 Indumentaria Segura SRL. Todos los derechos reservados.</p>
          <a href="/privacy" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">Política de Privacidad</a>
        </div>
      </footer>
    </div>
  )
}
