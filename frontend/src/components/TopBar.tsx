import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu, Bell, BellOff, Moon, Sun } from 'lucide-react'
import LogoIndseg from './LogoIndseg'

const PAGE_NAMES: Record<string, string> = {
  '/':             'Dashboard',
  '/leads':        'Leads',
  '/mercadolibre': 'Mercado Libre',
  '/whatsapp':     'WhatsApp',
  '/settings':     'Configuración',
}

interface Props { onMenuClick: () => void }

export default function TopBar({ onMenuClick }: Props) {
  const { pathname } = useLocation()
  const pageName = PAGE_NAMES[pathname] ?? 'Panel'
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default')
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    if ('Notification' in window) setNotifPerm(Notification.permission)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const handleBell = async () => {
    if (!('Notification' in window)) return
    if (notifPerm === 'granted') {
      new Notification('INDSEG', { body: 'Las notificaciones ya están activas ✓', icon: '/icon-192.png' })
      return
    }
    const result = await Notification.requestPermission()
    setNotifPerm(result)
    if (result === 'granted') {
      new Notification('INDSEG', { body: '¡Notificaciones activadas!', icon: '/icon-192.png' })
    }
  }

  const bellActive  = notifPerm === 'granted'
  const bellBlocked = notifPerm === 'denied'

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-topbar">
      <div className="flex items-center justify-between px-4 h-14">

        {/* Left */}
        <div className="flex items-center gap-3">
          {/* Hamburger — desktop only (mobile uses bottom nav) */}
          <button
            onClick={onMenuClick}
            className="hidden md:flex p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu size={18} />
          </button>

          {/* Mobile: logo + page name */}
          <div className="flex items-center gap-2 md:hidden">
            <LogoIndseg variant="icon" iconSize={26} />
            <span className="text-sm font-bold text-slate-800">{pageName}</span>
          </div>

          {/* Desktop breadcrumb */}
          <span className="hidden md:block text-sm font-semibold text-slate-700">{pageName}</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleBell}
            title={bellBlocked ? 'Notificaciones bloqueadas' : bellActive ? 'Notificaciones activas' : 'Activar notificaciones'}
            className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {bellBlocked
              ? <BellOff size={18} className="text-red-400" />
              : <Bell size={18} />
            }
            {!bellActive && !bellBlocked && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            )}
            {bellActive && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full" />
            )}
          </button>

          <button
            onClick={() => setDark(d => !d)}
            title={dark ? 'Modo claro' : 'Modo oscuro'}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="ml-1 flex items-center gap-2 pl-3 border-l border-slate-100">
            <LogoIndseg variant="icon" iconSize={30} />
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-700 leading-tight">Admin</p>
              <p className="text-[10px] text-slate-400">Administrador</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notification banners */}
      {notifPerm === 'default' && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Activá las notificaciones</span> para alertas de preguntas ML
          </p>
          <button onClick={handleBell} className="shrink-0 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg transition-colors">
            Activar
          </button>
        </div>
      )}
      {notifPerm === 'denied' && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2">
          <p className="text-xs text-red-700">
            <span className="font-semibold">Notificaciones bloqueadas.</span>{' '}
            Tocá 🔒 junto a la URL → Configuración del sitio → Notificaciones → Preguntar → recargá.
          </p>
        </div>
      )}
    </header>
  )
}
