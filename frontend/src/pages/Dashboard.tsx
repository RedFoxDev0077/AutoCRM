import { useEffect, useState } from 'react'
import { Users, UserCheck, MapPin, ShoppingBag, Sparkles, MessageCircle, RefreshCw, ArrowUpRight, TrendingUp, ShoppingCart, AlertTriangle, Flame, ChevronRight } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'
import StatCard from '../components/StatCard'
import { getDashboardStats, getLeads, getMLDailySales, getHotLeads } from '../api/client'
import type { DashboardStats, Lead } from '../types'

interface HotLead { id: number; name: string; score: number; tags: string[]; created_at: number }

/* ── mock 7-day activity data ── */
const activityData = [
  { day: 'Lun', mensajes: 8,  leads: 5  },
  { day: 'Mar', mensajes: 14, leads: 9  },
  { day: 'Mié', mensajes: 11, leads: 7  },
  { day: 'Jue', mensajes: 19, leads: 13 },
  { day: 'Vie', mensajes: 24, leads: 16 },
  { day: 'Sáb', mensajes: 17, leads: 11 },
  { day: 'Dom', mensajes: 13, leads: 8  },
]
const barData = [
  { day: 'L', v: 5 }, { day: 'M', v: 9 }, { day: 'X', v: 7 },
  { day: 'J', v: 13 }, { day: 'V', v: 16 }, { day: 'S', v: 11 }, { day: 'D', v: 8 },
]

const STATUS_BADGE: Record<string, string> = {
  new: 'badge-new', contacted: 'badge-contacted',
  responded: 'badge-responded', converted: 'badge-converted',
}
const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', responded: 'Respondió', converted: 'Convertido',
}

function Avatar({ name }: { name: string }) {
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-slate-600">{initials}</span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-elevated px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name === 'mensajes' ? 'WhatsApp' : 'Leads'}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats]           = useState<DashboardStats | null>(null)
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [sales, setSales]           = useState<any>(null)
  const [hotLeads, setHotLeads]     = useState<HotLead[]>([])
  const [loading, setLoading]       = useState(false)
  const [activeTab, setActiveTab]   = useState<'7D' | '30D' | 'Hoy'>('7D')

  const load = async () => {
    setLoading(true)
    try {
      const [s, l] = await Promise.all([getDashboardStats(), getLeads(1)])
      setStats(s)
      setRecentLeads(l.leads.slice(0, 6))
    } catch {}
    finally { setLoading(false) }
  }

  const loadSales = async () => {
    try { setSales(await getMLDailySales()) } catch {}
  }

  const loadHotLeads = async () => {
    try { setHotLeads(await getHotLeads()) } catch {}
  }

  useEffect(() => {
    load()
    loadSales()
    loadHotLeads()
    const t  = setInterval(load, 30000)
    const t2 = setInterval(loadSales, 5 * 60 * 1000)
    const t3 = setInterval(loadHotLeads, 5 * 60 * 1000)
    return () => { clearInterval(t); clearInterval(t2); clearInterval(t3) }
  }, [])

  const wa = (stats as any)
  const contactRate = wa?.maps_leads > 0
    ? Math.round((wa.maps_contacted / wa.maps_leads) * 100)
    : 0

  return (
    <div className="page">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Panel de Control</h1>
          <p className="text-sm text-slate-400 mt-0.5">Resumen en tiempo real de todos los canales</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-xs px-3 py-2">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* ── Main chart + mini stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Area chart card — 2/3 */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-700">Actividad del Sistema</h2>
              <p className="text-xs text-slate-400 mt-0.5">Mensajes WhatsApp y leads captados</p>
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 self-start">
              {(['Hoy', '7D', '30D'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeTab === tab
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Inline metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 mb-4 border-b border-slate-50">
            {[
              { label: 'Mensajes WA Hoy', value: stats?.messages_today ?? '—' },
              { label: 'Contactos Únicos', value: wa?.wa_contacts ?? '—' },
              { label: 'Leads Maps', value: wa?.maps_leads ?? '—' },
              { label: 'ML Publicaciones', value: stats?.total_listings ?? '—' },
            ].map(m => (
              <div key={m.label}>
                <p className="text-xs text-slate-400 font-medium">{m.label}</p>
                <p className="text-xl font-bold text-slate-800 tabular-nums mt-0.5">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activityData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gMensajes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="mensajes" stroke="#10B981" strokeWidth={2} fill="url(#gMensajes)" dot={false} />
              <Area type="monotone" dataKey="leads"    stroke="#3B82F6" strokeWidth={2} fill="url(#gLeads)"    dot={false} />
            </AreaChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center gap-5 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-0.5 rounded bg-brand-accent inline-block" />WhatsApp</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-0.5 rounded bg-blue-500 inline-block" />Leads Maps</span>
          </div>
        </div>

        {/* Mini stats — 1/3 */}
        <div className="flex flex-row lg:flex-col gap-4">
          {/* Contact rate */}
          <div className="flex-1 card p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400 font-medium">Tasa de Contacto</p>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight size={12} /> {contactRate}%
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{wa?.maps_contacted ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-0.5">de {wa?.maps_leads ?? 0} leads contactados</p>
            <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-brand-accent to-brand-mid transition-all duration-500"
                style={{ width: `${Math.min(contactRate, 100)}%` }}
              />
            </div>
            <div className="h-14 -mx-1 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={6}>
                  <Bar dataKey="v" fill="#10B981" opacity={0.6} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ML pending */}
          <div className="flex-1 card p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400 font-medium">ML Pendientes</p>
              <span className="text-xs font-bold text-amber-500 flex items-center gap-0.5">
                <Sparkles size={11} /> IA
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{stats?.pending_optimizations ?? '—'}</p>
            <p className="text-xs text-slate-400 mt-0.5">publicaciones por optimizar</p>
            <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                style={{ width: stats?.total_listings ? `${Math.min((stats.pending_optimizations / stats.total_listings) * 100, 100)}%` : '0%' }}
              />
            </div>
            <p className="text-[10px] text-slate-300 mt-2">{stats?.total_listings ?? 0} publicaciones totales</p>
          </div>
        </div>
      </div>

      {/* ── 6 Stat cards (2 rows of 3 on desktop) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          label="Mensajes WA Hoy"
          value={stats?.messages_today ?? '—'}
          icon={MessageCircle}
          sub="Entrantes hoy"
          trend={8}
          sparkData={[3, 5, 4, 7, 6, 9, stats?.messages_today as number || 8]}
          color="teal"
        />
        <StatCard
          label="Contactos Únicos WA"
          value={wa?.wa_contacts ?? '—'}
          icon={Users}
          sub="Total acumulado"
          trend={12}
          sparkData={[10, 14, 13, 18, 20, 23, wa?.wa_contacts || 20]}
          color="blue"
        />
        <StatCard
          label="Leads Google Maps"
          value={wa?.maps_leads ?? '—'}
          icon={MapPin}
          sub={`${wa?.maps_contacted ?? 0} contactados`}
          trend={18}
          sparkData={[5, 9, 8, 14, 12, 17, wa?.maps_leads || 15]}
          color="green"
        />
        <StatCard
          label="Ventas ML Hoy"
          value={sales ? `$${Math.round(sales.total).toLocaleString('es-AR')}` : '—'}
          icon={TrendingUp}
          sub={sales ? `${sales.count} orden${sales.count !== 1 ? 'es' : ''}` : 'Cargando...'}
          trend={sales?.count > 0 ? 10 : 0}
          sparkData={[0, 0, 0, 0, 0, 0, sales?.count || 0]}
          color="purple"
        />
        <StatCard
          label="Ventas ML Mes"
          value={wa?.total_ventas ? `$${Math.round(wa.total_ventas).toLocaleString('es-AR')}` : '—'}
          icon={ShoppingCart}
          sub={wa?.total_orders ? `${wa.total_orders} órdenes este mes` : 'mes actual'}
          trend={undefined}
          sparkData={[1, 2, 3, 4, 5, 6, 7]}
          color="orange"
        />
        <StatCard
          label="Reclamos ML"
          value={wa?.reclamos_rate !== undefined ? `${wa.reclamos_rate}%` : '—'}
          icon={AlertTriangle}
          sub={wa?.reclamos > 0 ? `${wa.reclamos} abiertos · ${wa.reclamos_period}` : `Sin reclamos · ${wa?.reclamos_period ?? '60 días'}`}
          trend={wa?.reclamos_rate > 0 ? -(wa.reclamos_rate) : undefined}
          sparkData={[0, 0, 0, 0, 0, 0, wa?.reclamos_rate || 0]}
          color="rose"
        />
      </div>

      {/* ── Hot Leads ── */}
      {hotLeads.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                <Flame size={14} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-700">Leads Calientes — Prioridad IA</h2>
                <p className="text-xs text-slate-400">Puntuados automáticamente · mayor score = más urgente</p>
              </div>
            </div>
            <button onClick={loadHotLeads} className="btn-ghost text-xs px-2 py-1.5">
              <RefreshCw size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {hotLeads.map(lead => {
              const scoreColor = lead.score >= 8
                ? 'bg-red-50 text-red-600 border-red-100'
                : lead.score >= 6
                ? 'bg-orange-50 text-orange-600 border-orange-100'
                : 'bg-slate-50 text-slate-500 border-slate-200'
              const isGads = lead.tags.some(t => t.toLowerCase().includes('google') || t.toLowerCase() === 'gads')
              return (
                <div key={lead.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 font-bold text-sm tabular-nums ${scoreColor}`}>
                    {lead.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{lead.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {isGads && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">Google Ads</span>
                      )}
                      {lead.tags.filter(t => !t.toLowerCase().includes('google') && t.toLowerCase() !== 'gads' && t !== 'AutoCRM').slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={`https://indumentariasegura.kommo.com/leads/detail/${lead.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1 text-xs text-brand-accent hover:underline font-medium"
                  >
                    Kommo <ChevronRight size={11} />
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ML Sales Today ── */}
      {sales && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center">
                <ShoppingCart size={14} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-700">Ventas ML — Hoy</h2>
                <p className="text-xs text-slate-400">
                  {sales.count} {sales.count === 1 ? 'orden pagada' : 'órdenes pagadas'} ·{' '}
                  <span className="font-semibold text-emerald-600">
                    ${Math.round(sales.total).toLocaleString('es-AR')} ARS
                  </span>
                </p>
              </div>
            </div>
            <a href="/mercadolibre" className="text-xs text-brand-accent font-semibold hover:text-brand-mid transition-colors flex items-center gap-1">
              Ver ML <ArrowUpRight size={12} />
            </a>
          </div>

          {sales.orders.length === 0 ? (
            <div className="py-10 text-center">
              <ShoppingCart size={26} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Sin ventas registradas hoy</p>
              <p className="text-xs text-slate-300 mt-0.5">Las ventas pagadas en ML aparecen aquí automáticamente</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {sales.orders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <ShoppingBag size={13} className="text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{o.title}</p>
                      <p className="text-xs text-slate-400">
                        x{o.quantity}{o.extra_items > 0 ? ` + ${o.extra_items} producto${o.extra_items > 1 ? 's' : ''} más` : ''} · {new Date(o.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 shrink-0 ml-3">
                    ${Math.round(o.total).toLocaleString('es-AR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom: leads table + activity feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent leads — 2/3 */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <div>
              <h2 className="text-sm font-bold text-slate-700">Últimos Leads — Google Maps</h2>
              <p className="text-xs text-slate-400 mt-0.5">6 más recientes</p>
            </div>
            <a href="/leads" className="text-xs text-brand-accent font-semibold hover:text-brand-mid transition-colors flex items-center gap-1">
              Ver todos <ArrowUpRight size={12} />
            </a>
          </div>

          {recentLeads.length === 0 ? (
            <div className="py-16 text-center">
              <MapPin size={28} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Sin leads aún</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Negocio</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Teléfono</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={lead.business_name || lead.name || '?'} />
                        <span className="font-semibold text-slate-700 text-sm">{lead.business_name || lead.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500 hidden sm:table-cell">{lead.phone}</td>
                    <td className="px-5 py-3">
                      <span className={STATUS_BADGE[lead.status]}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                        {STATUS_LABEL[lead.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Activity feed — 1/3 */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="text-sm font-bold text-slate-700">Actividad Reciente</h2>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              En vivo
            </span>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto max-h-80">
            {recentLeads.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-8">Sin actividad</p>
            ) : recentLeads.map((lead, i) => {
              const colors = ['bg-emerald-100 text-emerald-600', 'bg-blue-100 text-blue-600', 'bg-amber-100 text-amber-600', 'bg-violet-100 text-violet-600']
              const icons  = [MessageCircle, MapPin, UserCheck, ShoppingBag]
              const IconC  = icons[i % icons.length]
              const timeAgo = ['2m', '15m', '1h', '2h', '4h', '5h'][i] || '6h'
              return (
                <div key={lead.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full ${colors[i % colors.length]} flex items-center justify-center shrink-0 mt-0.5`}>
                    <IconC size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{lead.business_name || lead.name}</p>
                    <p className="text-xs text-slate-400 truncate">{lead.phone}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={STATUS_BADGE[lead.status] + ' text-[10px] py-0.5 px-2'}>
                        {STATUS_LABEL[lead.status]}
                      </span>
                      <span className="text-[10px] text-slate-300">{timeAgo} atrás</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
