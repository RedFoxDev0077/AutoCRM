import { NavLink } from 'react-router-dom'
import { LayoutDashboard, MapPin, ShoppingBag, MessageCircle, Settings, X, LogOut, Sparkles, Linkedin, BarChart2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import LogoIndseg from './LogoIndseg'

const navMain = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/leads',        icon: MapPin,          label: 'Leads'         },
  { to: '/mercadolibre', icon: ShoppingBag,     label: 'Mercado Libre' },
  { to: '/whatsapp',     icon: MessageCircle,   label: 'WhatsApp'      },
]

const navIA = [
  { to: '/contenido',  icon: Sparkles,   label: 'Contenido IA' },
  { to: '/linkedin',   icon: Linkedin,   label: 'LinkedIn'     },
  { to: '/google-ads', icon: BarChart2,  label: 'Google Ads'   },
]

const navBottom = [
  { to: '/settings', icon: Settings, label: 'Configuración' },
]

const nav = [...navMain, ...navIA, ...navBottom]

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  const { logout } = useAuth()
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={onClose} />}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        w-[220px] min-h-screen flex flex-col shrink-0
        bg-white border-r border-slate-100
        transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <LogoIndseg variant="compact" iconSize={28} />
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-600 p-1">
            <X size={17} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Menú</p>
          {navMain.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive ? 'bg-brand-pale text-brand-accent' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}>
              {({ isActive }) => (<><Icon size={17} className={isActive ? 'text-brand-accent' : 'text-slate-400'} />{label}</>)}
            </NavLink>
          ))}

          <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Herramientas IA</p>
          {navIA.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive ? 'bg-brand-pale text-brand-accent' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}>
              {({ isActive }) => (<><Icon size={17} className={isActive ? 'text-brand-accent' : 'text-slate-400'} />{label}</>)}
            </NavLink>
          ))}

          <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sistema</p>
          {navBottom.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive ? 'bg-brand-pale text-brand-accent' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}>
              {({ isActive }) => (<><Icon size={17} className={isActive ? 'text-brand-accent' : 'text-slate-400'} />{label}</>)}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <LogoIndseg variant="icon" iconSize={28} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-700 truncate">Indumentaria Segura</p>
              <p className="text-[10px] text-slate-400 truncate">panel.indumentariasegura.com.ar</p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
