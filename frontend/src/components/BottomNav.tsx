import { NavLink } from 'react-router-dom'
import { LayoutDashboard, MapPin, ShoppingBag, MessageCircle, Settings } from 'lucide-react'

const nav = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Inicio' },
  { to: '/leads',        icon: MapPin,          label: 'Leads'  },
  { to: '/mercadolibre', icon: ShoppingBag,     label: 'ML'     },
  { to: '/whatsapp',     icon: MessageCircle,   label: 'WA'     },
  { to: '/settings',     icon: Settings,        label: 'Config' },
]

export default function BottomNav() {
  return (
    <nav
      className="bottom-nav md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-100 flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {nav.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/dashboard'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              isActive ? 'text-brand-accent' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`flex items-center justify-center w-9 h-7 rounded-xl transition-colors ${
                isActive ? 'bg-brand-pale' : ''
              }`}>
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-semibold leading-none">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
