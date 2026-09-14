import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import MercadoLibre from './pages/MercadoLibre'
import WhatsApp from './pages/WhatsApp'
import Settings from './pages/Settings'
import Landing from './pages/Landing'
import Login from './pages/Login'
import { externalNextPage, openExternalPage } from './utils/nextPage'
import Contenido from './pages/Contenido'
import LinkedIn from './pages/LinkedIn'
import GoogleAds from './pages/GoogleAds'
import { AuthProvider, useAuth } from './context/AuthContext'
import { getMLQuestions, subscribePush } from './api/client'

const VAPID_PUBLIC_KEY = 'BO70W1l6Me_DyBEpdInbJFOO_SuBxHymQre_9g6hLY6xaRSJ5M3fUFYmQdWPWdoDUv9amlo5tIcU5np39wowu6Y'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function showNotification(title: string, body: string, url = '/mercadolibre') {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, {
      body, icon: '/icon-192.png', badge: '/icon-192.png', data: { url },
    } as NotificationOptions)
  } catch {
    if (Notification.permission === 'granted') new Notification(title, { body, icon: '/icon-192.png' })
  }
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
    })
    const key = sub.getKey('p256dh')
    const auth = sub.getKey('auth')
    if (!key || !auth) return
    await subscribePush({
      endpoint: sub.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
      auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
    })
  } catch (e) { console.warn('[push] subscribe failed:', e) }
}

function useNotifications() {
  const lastCount = useRef<number | null>(null)
  useEffect(() => {
    if (!('Notification' in window)) return
    const setup = async () => {
      let perm = Notification.permission
      if (perm === 'default') perm = await Notification.requestPermission()
      if (perm === 'granted') await subscribeToPush()
    }
    setup()
    const poll = async () => {
      if (Notification.permission !== 'granted') return
      try {
        const qs: any[] = await getMLQuestions('UNANSWERED')
        const count = qs.length
        if (lastCount.current !== null && count > lastCount.current) {
          const diff = count - lastCount.current
          await showNotification(
            'AutoCRM — Nueva pregunta en ML',
            `Tenés ${diff} pregunta${diff > 1 ? 's' : ''} nueva${diff > 1 ? 's' : ''} sin responder`,
          )
        }
        lastCount.current = count
      } catch { }
    }
    poll()
    const id = setInterval(poll, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
}

function ProtectedApp() {
  const { token } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  useNotifications()

  // Check localStorage directly — context state update may lag behind navigate()
  const isAuthed = token || localStorage.getItem('autocrm_token')
  if (!isAuthed) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Routes>
            <Route path="/dashboard"   element={<Dashboard />} />
            <Route path="/leads"       element={<Leads />} />
            <Route path="/mercadolibre" element={<MercadoLibre />} />
            <Route path="/whatsapp"    element={<WhatsApp />} />
            <Route path="/settings"    element={<Settings />} />
            <Route path="/contenido"   element={<Contenido />} />
            <Route path="/linkedin"    element={<LinkedIn />} />
            <Route path="/google-ads"  element={<GoogleAds />} />
            {/* The SPA shell should never serve /cotizador/ (nginx serves the static app),
                but a stale cached shell can; reload from the server instead of bouncing to /dashboard. */}
            <Route path="/cotizador/*" element={<ExternalRedirect to="/cotizador/" />} />
            <Route path="*"            element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/"       element={<Landing />} />
        <Route path="/login"  element={<LoginGuard />} />
        <Route path="/*"      element={<ProtectedApp />} />
      </Routes>
    </AuthProvider>
  )
}

function LoginGuard() {
  const { token } = useAuth()
  if (token) {
    const next = externalNextPage()
    if (next) return <ExternalRedirect to={next} />
    return <Navigate to="/dashboard" replace />
  }
  return <Login />
}

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => { openExternalPage(to) }, [to])
  return null
}
