import { useEffect, useState, useRef } from 'react'
import { Search, MapPin, MessageCircle, ChevronLeft, ChevronRight, SlidersHorizontal, Upload, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { getLeads, searchLeads, updateLeadStatus, contactLead } from '../api/client'
import api from '../api/client'
import type { Lead } from '../types'

const STATUS_BADGE: Record<string, string> = {
  new:       'badge-new',
  contacted: 'badge-contacted',
  responded: 'badge-responded',
  converted: 'badge-converted',
}
const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo', contacted: 'Contactado', responded: 'Respondió', converted: 'Convertido'
}
const SOURCE_LABEL: Record<string, string> = {
  google_maps: 'Google Maps', kommo: 'Kommo', google_ads: 'Google Ads', mercadolibre: 'Mercado Libre'
}

function InitialAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-slate-500">{initials || '?'}</span>
    </div>
  )
}

export default function Leads() {
  const [leads, setLeads]         = useState<Lead[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(false)
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [query, setQuery]         = useState('')
  const [location, setLocation]   = useState('Buenos Aires')
  const [radius, setRadius]       = useState(10)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async (p = page) => {
    setLoading(true)
    try {
      const data = await getLeads(p)
      setLeads(data.leads)
      setTotal(data.total)
    } catch { toast.error('Error al cargar leads') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [page])

  const handleSearch = async () => {
    if (!query.trim()) return toast.error('Ingresá un rubro')
    setSearching(true)
    try {
      const res = await searchLeads(query, location, radius)
      toast.success(`${res.new_leads} leads nuevos encontrados`)
      load(1)
    } catch { toast.error('Error al buscar en Google Maps') }
    finally { setSearching(false) }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/leads/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const { imported, skipped, errors } = res.data
      toast.success(`${imported} importados · ${skipped} duplicados · ${errors} errores`)
      load(1)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error al importar archivo')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleStatus = async (id: number, status: string) => {
    try {
      const updated = await updateLeadStatus(id, status)
      setLeads(prev => prev.map(l => l.id === id ? updated : l))
    } catch { toast.error('Error al actualizar estado') }
  }

  const handleContact = async (lead: Lead) => {
    try {
      const res = await contactLead(lead.id)
      setLeads(prev => prev.map(l => l.id === lead.id ? res.lead : l))
      window.open(res.wa_link, '_blank')
      if (res.kommo_synced) {
        toast.success('Abierto en WhatsApp · Lead sincronizado con Kommo')
      } else {
        toast.success('Abierto en WhatsApp')
        if (res.kommo_error) console.warn('[kommo]', res.kommo_error)
      }
    } catch {
      // Fallback: just open WA directly
      window.open(`https://wa.me/${lead.phone}`, '_blank')
      toast('Abriendo WhatsApp...', { icon: '📱' })
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Captación de Leads</h1>
          <p className="text-sm text-slate-500 mt-1">Google Maps · {total} leads registrados</p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="btn-secondary text-sm"
          >
            {importing
              ? <><Upload size={14} className="animate-pulse" /> Importando...</>
              : <><FileSpreadsheet size={14} /> Importar Excel / CSV</>
            }
          </button>
        </div>
      </div>

      {/* Format hint */}
      <div className="card border-blue-100 bg-blue-50/50 px-4 py-3 flex items-start gap-3">
        <FileSpreadsheet size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-600 leading-relaxed">
          <strong>Formato requerido:</strong> columnas <code className="bg-blue-100 px-1 rounded">phone</code> (o <code className="bg-blue-100 px-1 rounded">telefono</code>) y <code className="bg-blue-100 px-1 rounded">name</code> (o <code className="bg-blue-100 px-1 rounded">nombre</code>).
          El sistema envía el mensaje de primer contacto automáticamente a cada número nuevo.
        </p>
      </div>

      {/* Search form */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-accent to-brand-mid flex items-center justify-center">
            <SlidersHorizontal size={13} className="text-white" />
          </div>
          <h2 className="text-sm font-semibold text-slate-700">Nueva búsqueda en Google Maps</h2>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end">
          <div className="flex-1 min-w-0 sm:min-w-40">
            <label className="label">Rubro</label>
            <input
              className="input"
              placeholder="ej: indumentaria, ferretería..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="flex-1 min-w-0 sm:min-w-40">
            <label className="label">Zona</label>
            <input
              className="input"
              placeholder="ej: Buenos Aires, Palermo..."
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>
          <div className="sm:w-44">
            <label className="label">Radio: <span className="text-brand-accent font-bold">{radius} km</span></label>
            <input
              type="range" min={1} max={50} value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="w-full accent-brand-accent h-2 mt-1"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="btn-primary"
          >
            <Search size={15} />
            {searching ? 'Buscando...' : 'Buscar Leads'}
          </button>
        </div>
      </div>

      {/* Leads list */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Leads registrados</h2>
            <p className="text-xs text-slate-400 mt-0.5">{total} en total</p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">Cargando leads...</div>
        ) : leads.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <MapPin size={26} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Sin leads aún</p>
            <p className="text-slate-400 text-sm mt-1">Usá el buscador de arriba para captar leads</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50 bg-slate-50/60">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Negocio</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Teléfono</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Dirección</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Origen</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <InitialAvatar name={lead.business_name || lead.name || '?'} />
                          <span className="font-semibold text-slate-700">{lead.business_name || lead.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-medium">{lead.phone}</td>
                      <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate">{lead.address || '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="badge bg-slate-50 text-slate-600 border-slate-200 text-xs">
                          {SOURCE_LABEL[lead.source] || lead.source}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={STATUS_BADGE[lead.status]}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                          {STATUS_LABEL[lead.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleContact(lead)}
                            className="flex items-center gap-1.5 text-xs text-brand-accent hover:text-brand-mid font-semibold px-2.5 py-1.5 rounded-lg hover:bg-brand-pale transition-colors"
                          >
                            <MessageCircle size={13} /> Contactar
                          </button>
                          <select
                            value={lead.status}
                            onChange={e => handleStatus(lead.id, e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:border-brand-accent cursor-pointer"
                          >
                            <option value="new">Nuevo</option>
                            <option value="contacted">Contactado</option>
                            <option value="responded">Respondió</option>
                            <option value="converted">Convertido</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-50">
              {leads.map(lead => (
                <div key={lead.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <InitialAvatar name={lead.business_name || lead.name || '?'} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-700 text-sm truncate">{lead.business_name || lead.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{lead.phone}</p>
                    </div>
                    <span className={STATUS_BADGE[lead.status]}>
                      {STATUS_LABEL[lead.status]}
                    </span>
                  </div>
                  {lead.address && (
                    <p className="text-xs text-slate-400 truncate pl-11">{lead.address}</p>
                  )}
                  <div className="flex items-center justify-between pl-11">
                    <span className="badge bg-slate-50 text-slate-600 border-slate-200 text-xs">
                      {SOURCE_LABEL[lead.source] || lead.source}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleContact(lead)}
                        className="flex items-center gap-1 text-xs text-brand-accent font-semibold px-2 py-1 rounded-lg hover:bg-brand-pale transition-colors"
                      >
                        <MessageCircle size={12} /> Contactar
                      </button>
                      <select
                        value={lead.status}
                        onChange={e => handleStatus(lead.id, e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-600 focus:outline-none"
                      >
                        <option value="new">Nuevo</option>
                        <option value="contacted">Contactado</option>
                        <option value="responded">Respondió</option>
                        <option value="converted">Convertido</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-50 bg-slate-50/40">
            <span className="text-xs text-slate-400 font-medium">Página {page} de {totalPages}</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={15} className="text-slate-600" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={15} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
