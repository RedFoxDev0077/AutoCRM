import { useState, useEffect } from 'react'
import { BarChart2, Copy, Check, ExternalLink, RefreshCw, ChevronRight, MessageCircle, Tag } from 'lucide-react'
import api from '../api/client'

interface Lead {
  id: number
  name: string
  created_at: number
  pipeline_id: number
  status_id: number
}

interface WaLink {
  url: string | null
  message: string
  trigger: string
  phone?: string
}

function CopyBtn({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-all border border-slate-200">
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? 'Copiado' : label}
    </button>
  )
}

function formatDate(ts: number) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function parseName(name: string) {
  const base = name.replace(/^GAds - /, '')
  const parts = base.split(' | ')
  return { person: parts[0] || base, phone: parts[1] || '' }
}

export default function GoogleAds() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [waLink, setWaLink] = useState<WaLink | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = async (from = dateFrom, to = dateTo) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (from) params.date_from = from
      if (to) params.date_to = to
      const [leadsRes, linkRes] = await Promise.all([
        api.get('/google-ads/leads', { params }),
        api.get('/google-ads/wa-link'),
      ])
      setLeads(leadsRes.data)
      setWaLink(linkRes.data)
    } catch { setLeads([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4285F4] flex items-center justify-center">
            <BarChart2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Google Ads</h1>
            <p className="text-sm text-slate-500">Leads de Google Ads → WhatsApp → Kommo automático</p>
          </div>
        </div>
        <button onClick={() => load(dateFrom, dateTo)} disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Date filter */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Desde</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4285F4]" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Hasta</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4285F4]" />
        </div>
        <button onClick={() => load(dateFrom, dateTo)}
          className="px-4 py-2 rounded-xl bg-[#4285F4] text-white text-sm font-semibold hover:bg-blue-500 transition-all">
          Filtrar
        </button>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); load('', ''); }}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-all">
            Limpiar
          </button>
        )}
      </div>

      {/* Stats */}
      {(() => {
        const now = new Date()
        const todayStr = now.toISOString().slice(0, 10)
        const monthStr = now.toISOString().slice(0, 7)
        const todayCount = leads.filter(l => new Date(l.created_at * 1000).toISOString().slice(0, 10) === todayStr).length
        const monthCount = leads.filter(l => new Date(l.created_at * 1000).toISOString().slice(0, 7) === monthStr).length

        // Per-day breakdown last 7 days
        const last7: Record<string, number> = {}
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now); d.setDate(d.getDate() - i)
          last7[d.toISOString().slice(0, 10)] = 0
        }
        leads.forEach(l => {
          const day = new Date(l.created_at * 1000).toISOString().slice(0, 10)
          if (day in last7) last7[day]++
        })
        const maxDay = Math.max(...Object.values(last7), 1)

        return (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Total</p>
                <p className="text-2xl font-bold text-slate-800">{leads.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">identificados</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Hoy</p>
                <p className="text-2xl font-bold text-[#4285F4]">{todayCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">leads hoy</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Este mes</p>
                <p className="text-2xl font-bold text-green-600">{monthCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">este mes</p>
              </div>
            </div>

            {/* Last 7 days bar chart */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 mb-3">Últimos 7 días</p>
              <div className="flex items-end gap-1.5 h-16">
                {Object.entries(last7).map(([day, count]) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-slate-500 font-bold">{count > 0 ? count : ''}</span>
                    <div
                      className="w-full rounded-t-md bg-[#4285F4]/80 transition-all"
                      style={{ height: `${Math.max((count / maxDay) * 48, count > 0 ? 6 : 2)}px` }}
                    />
                    <span className="text-[9px] text-slate-400">{new Date(day).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      })()}

      {/* WhatsApp Link Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50">
          <MessageCircle size={16} className="text-green-500" />
          <h2 className="font-semibold text-slate-700 text-sm">Link de WhatsApp para Google Ads</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Usá este link como botón de WhatsApp en tu landing page. Cuando alguien hace click, el mensaje se pre-completa automáticamente y el CRM identifica que el contacto vino de Google Ads — etiquetándolo en Kommo sin intervención manual.
          </p>

          {/* The wa.me link */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Link para la landing page</p>
            {waLink?.url ? (
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2.5">
                <code className="text-xs text-slate-700 flex-1 truncate">{waLink.url}</code>
                <CopyBtn text={waLink.url} />
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700 font-semibold mb-1">Configurar número de WhatsApp</p>
                <p className="text-xs text-amber-600">Agregá <code className="bg-amber-100 px-1 rounded">WA_BUSINESS_PHONE</code> en el archivo <code className="bg-amber-100 px-1 rounded">.env</code> del servidor con el número de WhatsApp Business (ej: <code className="bg-amber-100 px-1 rounded">5491155554444</code>) y reiniciá con <code className="bg-amber-100 px-1 rounded">docker compose restart</code>.</p>
              </div>
            )}
          </div>

          {/* Pre-filled message */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Mensaje que se pre-completa automáticamente</p>
            <div className="flex items-center gap-2 bg-green-50 rounded-xl border border-green-200 px-3 py-2.5">
              <span className="text-xs text-green-700 flex-1 italic">"{waLink?.message || 'Hola, me contacto desde Google'}"</span>
              {waLink?.message && <CopyBtn text={waLink.message} />}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Tag size={12} className="text-blue-600" />
              <p className="text-xs font-bold text-blue-700">¿Cómo funciona?</p>
            </div>
            <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside">
              <li>La agencia coloca este link como CTA de WhatsApp en la landing page</li>
              <li>El visitante hace click → WhatsApp abre con el mensaje pre-cargado</li>
              <li>El CRM detecta el mensaje y etiqueta el lead como <strong>"Google Ads"</strong> en Kommo</li>
              <li>El lead aparece automáticamente en esta sección</li>
            </ol>
          </div>

          {/* Instructions for agency */}
          <div className="border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-600 mb-2">Instrucciones para la agencia (David)</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Reemplazá el botón de WhatsApp actual en <a href="https://indumentariasegura.com.ar/ropa-de-trabajo-segura/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-0.5">la landing page <ExternalLink size={10} /></a> con este link. No necesitás cambiar nada más en Google Ads.
            </p>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-700 text-sm">Leads de Google Ads</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{leads.length}</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={18} className="animate-spin text-slate-300 mr-2" />
            <span className="text-sm text-slate-400">Cargando leads...</span>
          </div>
        )}

        {!loading && leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <BarChart2 size={28} className="text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">Aún no hay leads de Google Ads</p>
            <p className="text-xs text-slate-400 mt-1">Cuando alguien llegue por el link de Google Ads aparecerá aquí</p>
          </div>
        )}

        {!loading && leads.length > 0 && (
          <div className="divide-y divide-slate-50">
            {leads.map(lead => {
              const { person, phone } = parseName(lead.name)
              return (
                <div key={lead.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#4285F4]/10 flex items-center justify-center shrink-0">
                    <BarChart2 size={14} className="text-[#4285F4]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{person}</p>
                    {phone && <p className="text-xs text-slate-500">{phone}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400">{formatDate(lead.created_at)}</p>
                    <a href={`https://indumentariasegura.kommo.com/leads/detail/${lead.id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#4285F4] hover:underline flex items-center gap-0.5 justify-end mt-0.5">
                      Ver en Kommo <ChevronRight size={11} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
