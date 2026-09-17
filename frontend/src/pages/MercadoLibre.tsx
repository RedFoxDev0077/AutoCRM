import { useEffect, useState } from 'react'
import {
  RefreshCw, Sparkles, Check, X, ShoppingBag, ExternalLink, Link,
  Zap, MessageSquare, Send, PlusCircle, Wand2, Rocket, ChevronDown, ChevronUp, Bell,
  TrendingUp, ShoppingCart, Pencil, Save,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getListings, syncListings, optimizeListing, approveListing, rejectListing, editListing,
  getMLQuestions, answerMLQuestion, generateListing, publishListing, getMLDailySales, syncMLSales,
  getMLBudgetAnalysis, compareMLListing,
} from '../api/client'
import api from '../api/client'
import type { Listing } from '../types'

type Tab = 'listings' | 'questions' | 'generator' | 'sales' | 'budget' | 'compare'

const STATUS_BADGE: Record<string, string> = {
  synced:   'badge bg-slate-50 text-slate-600 border-slate-200',
  pending:  'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge bg-red-50 text-red-600 border-red-100',
}
const STATUS_LABEL: Record<string, string> = {
  synced: 'Sin optimizar', pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado'
}

function fmt(d: string) {
  return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function toHttps(url: string) {
  return url ? url.replace(/^http:\/\//, 'https://') : url
}

// ── Saved replies ──────────────────────────────────────────────
type Respuesta = { id: number; titulo: string; texto: string; usos: number }

/** Fills {producto} and {stock} with the question's listing. */
function completarRespuesta(texto: string, item: any) {
  return texto
    .replace(/\{producto\}/gi, item?.title ?? 'el producto')
    .replace(/\{stock\}/gi, item?.available_quantity != null ? String(item.available_quantity) : '')
}

function GestorRespuestas({ respuestas, onChange, onClose }: {
  respuestas: Respuesta[]; onChange: () => void; onClose: () => void
}) {
  const [nuevo, setNuevo] = useState({ titulo: '', texto: '' })
  const [edit, setEdit] = useState<Record<number, { titulo: string; texto: string }>>({})
  const [guardando, setGuardando] = useState(false)

  const crear = async () => {
    if (!nuevo.titulo.trim() || !nuevo.texto.trim()) return toast.error('Completá el nombre y el texto')
    setGuardando(true)
    try {
      await api.post('/ml/respuestas', nuevo)
      setNuevo({ titulo: '', texto: '' })
      toast.success('Respuesta guardada')
      onChange()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail?.[0]?.msg ?? e?.response?.data?.detail ?? 'No se pudo guardar')
    } finally { setGuardando(false) }
  }
  const guardar = async (r: Respuesta) => {
    const v = edit[r.id]
    if (!v) return
    try {
      await api.put(`/ml/respuestas/${r.id}`, v)
      setEdit(prev => { const n = { ...prev }; delete n[r.id]; return n })
      toast.success('Cambios guardados')
      onChange()
    } catch { toast.error('No se pudo guardar') }
  }
  const borrar = async (r: Respuesta) => {
    if (!confirm(`¿Borrar la respuesta «${r.titulo}»?`)) return
    try { await api.delete(`/ml/respuestas/${r.id}`); onChange() }
    catch { toast.error('No se pudo borrar') }
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Respuestas guardadas</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Aparecen como botones en cada pregunta. Podés escribir <code className="text-[11px] bg-slate-100 px-1 rounded">{'{producto}'}</code> y
            <code className="text-[11px] bg-slate-100 px-1 rounded ml-1">{'{stock}'}</code>: se completan solos con la publicación.
          </p>
        </div>
        <button onClick={onClose} className="btn-ghost text-xs shrink-0"><X size={13} /> Cerrar</button>
      </div>

      <ul className="space-y-3">
        {respuestas.map(r => {
          const v = edit[r.id] ?? { titulo: r.titulo, texto: r.texto }
          const cambiado = !!edit[r.id]
          return (
            <li key={r.id} className="rounded-xl border border-slate-100 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input value={v.titulo} maxLength={60}
                  onChange={e => setEdit(prev => ({ ...prev, [r.id]: { ...v, titulo: e.target.value } }))}
                  className="input py-1.5 text-sm font-medium flex-1" aria-label="Nombre de la respuesta" />
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{r.usos} usos</span>
                {cambiado && <button onClick={() => guardar(r)} className="btn-primary py-1.5 px-3 text-xs"><Save size={12} /> Guardar</button>}
                <button onClick={() => borrar(r)} className="btn-ghost text-xs text-red-500 hover:bg-red-50" aria-label="Borrar respuesta"><X size={13} /></button>
              </div>
              <textarea rows={2} value={v.texto} maxLength={2000}
                onChange={e => setEdit(prev => ({ ...prev, [r.id]: { ...v, texto: e.target.value } }))}
                className="input resize-y text-sm py-2" aria-label="Texto de la respuesta" />
            </li>
          )
        })}
      </ul>

      <div className="rounded-xl border border-dashed border-slate-200 p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-600">Agregar una respuesta</p>
        <input value={nuevo.titulo} maxLength={60} placeholder="Nombre del botón (ej: Colores)"
          onChange={e => setNuevo(p => ({ ...p, titulo: e.target.value }))} className="input py-1.5 text-sm" />
        <textarea rows={2} value={nuevo.texto} maxLength={2000} placeholder="Hola, ¿cómo estás? ..."
          onChange={e => setNuevo(p => ({ ...p, texto: e.target.value }))} className="input resize-y text-sm py-2" />
        <button onClick={crear} disabled={guardando} className="btn-primary py-1.5 px-3 text-xs"><PlusCircle size={12} /> Guardar respuesta</button>
      </div>
    </div>
  )
}

// ── Questions tab ──────────────────────────────────────────────
function QuestionsPanel({ connected }: { connected: boolean | null }) {
  const [questions, setQuestions]   = useState<any[]>([])
  const [loading, setLoading]       = useState(false)
  const [answers, setAnswers]       = useState<Record<number, string>>({})
  const [sending, setSending]       = useState<number | null>(null)
  const [expanded, setExpanded]     = useState<Record<number, boolean>>({})
  const [showAll, setShowAll]       = useState(false)
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [gestor, setGestor]         = useState(false)

  const cargarRespuestas = async () => {
    try { setRespuestas((await api.get('/ml/respuestas')).data) } catch { /* the buttons just won't show */ }
  }
  useEffect(() => { cargarRespuestas() }, [])

  const usarRespuesta = (q: any, r: Respuesta) => {
    const texto = completarRespuesta(r.texto, q.item)
    setAnswers(prev => {
      const actual = (prev[q.id] || '').trim()
      return { ...prev, [q.id]: actual ? `${actual} ${texto}` : texto }
    })
    api.post(`/ml/respuestas/${r.id}/uso`).catch(() => {})
  }

  const load = async (status = showAll ? 'all' : 'UNANSWERED') => {
    if (!connected) return
    setLoading(true)
    try { setQuestions(await getMLQuestions(status)) }
    catch { toast.error('Error al cargar preguntas') }
    finally { setLoading(false) }
  }

  const syncToKommo = async () => {
    if (!connected) return
    try {
      const res = await api.post('/ml/questions/sync-kommo')
      if (res.data?.created > 0)
        toast.success(`${res.data.created} pregunta${res.data.created !== 1 ? 's' : ''} enviada${res.data.created !== 1 ? 's' : ''} a Kommo`)
    } catch { /* silent */ }
  }

  useEffect(() => {
    load().then(() => syncToKommo())
  }, [connected, showAll])

  const handleAnswer = async (q: any) => {
    const text = (answers[q.id] || '').trim()
    if (!text) return toast.error('Escribí una respuesta')
    setSending(q.id)
    try {
      await answerMLQuestion(q.id, text)
      toast.success('Respuesta enviada')
      setAnswers(prev => { const n = {...prev}; delete n[q.id]; return n })
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al responder')
    } finally { setSending(null) }
  }

  if (!connected) {
    return (
      <div className="card py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
          <MessageSquare size={24} className="text-amber-400" />
        </div>
        <p className="text-slate-500 font-medium">Conectá tu cuenta de ML primero</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => load()} disabled={loading} className="btn-ghost text-xs">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded accent-brand-accent" />
            Ver respondidas también
          </label>
          <button onClick={() => setGestor(v => !v)} className="btn-ghost text-xs">
            <Zap size={13} /> Respuestas guardadas
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">{questions.length} preguntas</span>
          {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
              <Bell size={12} className="text-red-400" />
              Notif. bloqueadas — ver instrucciones abajo
            </span>
          )}
          {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
            <button
              onClick={async () => {
                const r = await Notification.requestPermission()
                if (r === 'granted') {
                  const reg = await navigator.serviceWorker?.ready
                  reg?.showNotification('AutoCRM', { body: 'Notificaciones activadas ✓', icon: '/icon-192.png' })
                }
              }}
              className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Bell size={12} /> Activar notificaciones
            </button>
          )}
        </div>
      </div>

      {gestor && <GestorRespuestas respuestas={respuestas} onChange={cargarRespuestas} onClose={() => setGestor(false)} />}

      {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
        <div className="card border-red-100 bg-red-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <Bell size={14} /> Notificaciones bloqueadas en este navegador
          </p>
          <p className="text-xs text-red-600 leading-relaxed">
            Las notificaciones fueron bloqueadas porque se rechazó el permiso varias veces. Para activarlas:
          </p>
          <ol className="text-xs text-red-700 space-y-1 pl-4 list-decimal leading-relaxed">
            <li>Tocá el ícono <strong>🔒</strong> o <strong>⚙️</strong> a la izquierda de la URL en el navegador</li>
            <li>Seleccioná <strong>"Configuración del sitio"</strong> o <strong>"Permisos del sitio"</strong></li>
            <li>Buscá <strong>"Notificaciones"</strong> y cambialo de <strong>Bloquear → Preguntar</strong></li>
            <li>Recargá la página y tocá <strong>"Activar notificaciones"</strong></li>
          </ol>
        </div>
      )}

      {loading && questions.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm">Cargando preguntas...</div>
      ) : questions.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <MessageSquare size={24} className="text-emerald-400" />
          </div>
          <p className="text-slate-500 font-medium">Sin preguntas pendientes</p>
          <p className="text-slate-400 text-sm mt-1">Todas las preguntas están respondidas</p>
        </div>
      ) : (
        questions.map(q => {
          const isExpanded = expanded[q.id] !== false
          const answered = q.status === 'ANSWERED'
          const item = q.item
          const stock = item?.available_quantity ?? null
          const lowStock = stock !== null && stock <= 3

          return (
            <div key={q.id} className={`card overflow-hidden transition-shadow ${answered ? 'opacity-60' : 'hover:shadow-elevated'}`}>

              {/* Product strip */}
              {item && (
                <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-slate-50 bg-slate-50/60">
                  {item.thumbnail
                    ? <img src={toHttps(item.thumbnail)} alt="" className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-200 shrink-0" />
                    : <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><ShoppingBag size={16} className="text-slate-300" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                        stock === null ? 'bg-slate-100 text-slate-400'
                        : stock === 0 ? 'bg-red-100 text-red-700'
                        : lowStock ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {stock === null ? 'Stock: —' : stock === 0 ? 'Sin stock' : `Stock: ${stock} u.`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{q.item_id}</span>
                    </div>
                    {/* Variants stock breakdown */}
                    {item.variations && item.variations.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.variations.map((v: any, i: number) => (
                          <span key={i} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
                            v.stock === 0
                              ? 'bg-red-50 text-red-600 border-red-100'
                              : v.stock <= 2
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {v.label}: {v.stock === 0 ? 'sin stock' : `${v.stock} u.`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {item.permalink && (
                    <a href={item.permalink} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                      <ExternalLink size={12} className="text-slate-500" />
                    </a>
                  )}
                </div>
              )}

              {/* Question text + toggle */}
              <button
                className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left"
                onClick={() => setExpanded(prev => ({ ...prev, [q.id]: !isExpanded }))}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`badge text-[10px] ${answered ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'badge-pending'}`}>
                      {answered ? 'Respondida' : 'Sin responder'}
                    </span>
                    <span className="text-[10px] text-slate-400">{fmt(q.date_created)}</span>
                    {!item && q.item_id && (
                      <span className="text-[10px] text-slate-400 font-mono">{q.item_id}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 font-medium leading-snug pr-2">{q.text}</p>
                </div>
                <div className="shrink-0 mt-0.5">
                  {isExpanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                </div>
              </button>

              {/* Answer area */}
              {isExpanded && (
                <div className="border-t border-slate-50 px-4 py-3 bg-slate-50/40">
                  {answered && q.answer ? (
                    <div className="flex items-start gap-2">
                      <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-slate-600 leading-relaxed">{q.answer.text}</p>
                    </div>
                  ) : (
                    <>
                    {respuestas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {respuestas.map(r => (
                          <button key={r.id} onClick={() => usarRespuesta(q, r)} title={completarRespuesta(r.texto, q.item)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-brand-accent hover:text-brand-accent transition-colors">
                            {r.titulo}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 items-end">
                      <textarea
                        rows={2}
                        placeholder="Escribí tu respuesta..."
                        value={answers[q.id] || ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="input flex-1 resize-none text-sm py-2"
                      />
                      <button
                        onClick={() => handleAnswer(q)}
                        disabled={sending === q.id}
                        className="btn-primary py-2 px-3.5 text-sm shrink-0"
                      >
                        {sending === q.id
                          ? <RefreshCw size={14} className="animate-spin" />
                          : <Send size={14} />
                        }
                        {sending === q.id ? '' : 'Enviar'}
                      </button>
                    </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Generator tab ──────────────────────────────────────────────
function GeneratorPanel({ connected }: { connected: boolean | null }) {
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [refTitle, setRefTitle]           = useState('')
  const [generating, setGenerating]       = useState(false)
  const [generated, setGenerated]         = useState<any | null>(null)
  const [price, setPrice]                 = useState('')
  const [quantity, setQuantity]           = useState('1')
  const [condition, setCondition]         = useState('new')
  const [publishing, setPublishing]       = useState(false)

  const handleGenerate = async () => {
    if (!refTitle.trim() && !competitorUrl.trim()) {
      return toast.error('Ingresá un título o URL de referencia')
    }
    setGenerating(true)
    setGenerated(null)
    try {
      const res = await generateListing(refTitle, competitorUrl)
      setGenerated(res)
      toast.success('Publicación generada con IA')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al generar')
    } finally { setGenerating(false) }
  }

  const handlePublish = async () => {
    if (!generated) return
    if (!price || Number(price) <= 0) return toast.error('Ingresá un precio válido')
    if (!connected) return toast.error('Conectá tu cuenta de ML primero')
    setPublishing(true)
    try {
      const res = await publishListing({
        title: generated.title,
        description: generated.description,
        price: Number(price),
        quantity: Number(quantity) || 1,
        condition,
        category_id: generated.category_id || '',
      })
      toast.success('Publicación creada en Mercado Libre!')
      const permalink = res.permalink
      if (permalink) {
        setTimeout(() => window.open(permalink, '_blank'), 500)
      }
      setGenerated(null)
      setRefTitle('')
      setCompetitorUrl('')
      setPrice('')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al publicar en ML')
    } finally { setPublishing(false) }
  }

  return (
    <div className="space-y-4">
      {/* Input form */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center">
            <Wand2 size={13} className="text-white" />
          </div>
          <h2 className="text-sm font-semibold text-slate-700">Generar publicación con IA</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">URL de publicación de referencia (de ML, cualquier vendedor)</label>
            <input
              className="input"
              placeholder="ej: https://articulo.mercadolibre.com.ar/MLA-123456789-..."
              value={competitorUrl}
              onChange={e => setCompetitorUrl(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-xs text-slate-400">o</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          <div>
            <label className="label">Título / nombre del producto</label>
            <input
              className="input"
              placeholder="ej: Mameluco de trabajo ignífugo talle L"
              value={refTitle}
              onChange={e => setRefTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn-primary w-full justify-center"
        >
          <Sparkles size={15} className={generating ? 'animate-pulse' : ''} />
          {generating ? 'Generando con IA...' : 'Generar publicación'}
        </button>
      </div>

      {/* Preview + publish */}
      {generated && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 bg-emerald-50/50 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-700">Publicación generada — revisá y completá los datos</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Generated content */}
            <div className="space-y-3">
              <div>
                <p className="label">Título generado</p>
                <p className="text-sm font-semibold text-slate-800 bg-slate-50 rounded-xl px-3 py-2.5">{generated.title}</p>
              </div>
              <div>
                <p className="label">Descripción generada</p>
                <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {generated.description}
                </p>
              </div>
              {generated.improvements && (
                <p className="text-xs text-brand-mid italic">💡 {generated.improvements}</p>
              )}
            </div>

            {/* Publish fields */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Datos para publicar</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Precio (ARS) *</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="ej: 15000"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Stock</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Condición</label>
                  <select
                    className="input text-sm"
                    value={condition}
                    onChange={e => setCondition(e.target.value)}
                  >
                    <option value="new">Nuevo</option>
                    <option value="used">Usado</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handlePublish}
              disabled={publishing || !connected}
              className="btn-primary w-full justify-center"
            >
              <Rocket size={15} className={publishing ? 'animate-pulse' : ''} />
              {publishing ? 'Publicando...' : 'Publicar en Mercado Libre'}
            </button>
            {!connected && (
              <p className="text-xs text-amber-600 text-center">Conectá tu cuenta de ML para poder publicar</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sales tab ──────────────────────────────────────────────────
function SalesPanel({ connected, onReconnect }: { connected: boolean | null; onReconnect: () => void }) {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const load = async () => {
    if (!connected) return
    setLoading(true)
    try { setData(await getMLDailySales()) }
    catch { toast.error('Error al cargar ventas') }
    finally { setLoading(false) }
  }

  const handleSyncFromML = async () => {
    setSyncing(true)
    try {
      const res = await syncMLSales()
      toast.success(res.synced > 0 ? `${res.synced} ventas importadas` : 'Ventas ya actualizadas')
      await load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al sincronizar ventas')
    } finally { setSyncing(false) }
  }

  useEffect(() => { load() }, [connected])

  if (!connected) {
    return (
      <div className="card py-16 text-center">
        <TrendingUp size={24} className="mx-auto text-amber-400 mb-3" />
        <p className="text-slate-500 font-medium">Conectá tu cuenta de ML primero</p>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-400 font-medium capitalize">{today}</p>
            <h2 className="text-sm font-bold text-slate-700 mt-0.5">Ventas del día</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={load} disabled={loading} className="btn-ghost text-xs px-2.5 py-2" title="Actualizar">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button onClick={handleSyncFromML} disabled={syncing} className="btn-primary text-xs px-3 py-2" title="Sincronizar desde ML">
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{syncing ? 'Importando...' : 'Sincronizar'}</span>
              <span className="sm:hidden">{syncing ? '...' : 'Sync'}</span>
            </button>
            <button onClick={onReconnect} className="btn-secondary text-xs px-2.5 py-2" title="Reconectar ML">
              <Link size={13} />
              <span className="hidden sm:inline">Reconectar</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 rounded-2xl p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">
              {loading ? '…' : data?.count ?? 0}
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              {(data?.count ?? 0) === 1 ? 'orden pagada' : 'órdenes pagadas'}
            </p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 text-center overflow-hidden">
            <p className="text-lg sm:text-2xl md:text-3xl font-bold text-amber-500 tabular-nums truncate">
              {loading ? '…' : `$${Math.round(data?.total ?? 0).toLocaleString('es-AR')}`}
            </p>
            <p className="text-xs text-amber-600 font-medium mt-1">ARS facturado</p>
          </div>
        </div>
      </div>

      {/* Orders list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/40">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Detalle de órdenes
          </p>
        </div>

        {loading && !data ? (
          <div className="py-16 text-center text-slate-400 text-sm">Cargando ventas...</div>
        ) : !data || data.orders.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart size={28} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">Sin ventas hoy</p>
            <p className="text-slate-400 text-sm mt-1">Las órdenes pagadas en ML aparecen aquí</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.orders.map((o: any) => (
              <a
                key={o.id}
                href={`https://www.mercadolibre.com.ar/ventas/${o.id}/detalle`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors"
              >
                {/* Icon circle */}
                <div className="stat-icon-green shrink-0">
                  <ShoppingBag size={15} className="text-emerald-600" />
                </div>
                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate leading-snug">{o.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    x{o.quantity}
                    {o.extra_items > 0 && ` + ${o.extra_items} más`}
                    {' · '}
                    {new Date(o.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {/* Price + external link icon */}
                <div className="shrink-0 text-right flex items-center gap-2">
                  <div>
                    <p className="text-sm font-bold text-emerald-600">
                      ${Math.round(o.total).toLocaleString('es-AR')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">#{o.id.toString().slice(-6)}</p>
                  </div>
                  <ExternalLink size={12} className="text-slate-300" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function MercadoLibre() {
  const [tab, setTab]               = useState<Tab>('questions')
  const [listings, setListings]     = useState<Listing[]>([])
  const [loading, setLoading]       = useState(false)
  const [syncing, setSyncing]       = useState(false)
  const [optimizing, setOptimizing] = useState<number | null>(null)
  const [approving, setApproving]   = useState<number | null>(null)
  const [connected, setConnected]   = useState<boolean | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [editForm, setEditForm]     = useState<{ title: string; price: string; quantity: string }>({ title: '', price: '', quantity: '' })
  const [saving, setSaving]         = useState(false)

  const checkConnected = async () => {
    try {
      const r = await api.get('/ml/connected')
      setConnected(r.data.connected)
    } catch { setConnected(false) }
  }

  const load = async () => {
    setLoading(true)
    try { setListings(await getListings()) }
    catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { checkConnected(); load() }, [])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const r = await api.get('/ml/auth-url')
      const win = window.open(r.data.auth_url, '_blank', 'width=600,height=700')
      const poll = setInterval(async () => {
        if (win?.closed) {
          clearInterval(poll)
          await checkConnected()
          await load()
          setConnecting(false)
        }
      }, 1000)
    } catch {
      toast.error('No se pudo obtener el enlace de autorización')
      setConnecting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await syncListings()
      toast.success(`${res.synced} publicaciones sincronizadas`)
      load()
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      if (detail === 'ML_NOT_CONNECTED') {
        toast.error('Conectá tu cuenta de Mercado Libre primero')
        setConnected(false)
      } else {
        toast.error('Error al sincronizar con ML')
      }
    } finally { setSyncing(false) }
  }

  const handleOptimize = async (id: number) => {
    setOptimizing(id)
    try {
      const updated = await optimizeListing(id)
      setListings(prev => prev.map(l => l.id === id ? updated : l))
      toast.success('Sugerencia IA generada')
    } catch { toast.error('Error al optimizar con IA') }
    finally { setOptimizing(null) }
  }

  const handleApprove = async (id: number) => {
    setApproving(id)
    try {
      const updated = await approveListing(id)
      setListings(prev => prev.map(l => l.id === id ? updated : l))
      toast.success('Publicación actualizada en Mercado Libre ✓')
    } catch { toast.error('Error al aplicar cambios en ML') }
    finally { setApproving(null) }
  }

  const handleStartEdit = (listing: Listing) => {
    setEditingId(listing.id)
    setEditForm({ title: listing.title, price: String(listing.price), quantity: String(listing.available_quantity ?? 0) })
  }

  const handleSaveEdit = async (id: number) => {
    if (!editForm.title.trim()) return toast.error('El título no puede estar vacío')
    const price = parseFloat(editForm.price)
    const quantity = parseInt(editForm.quantity)
    if (isNaN(price) || price <= 0) return toast.error('Precio inválido')
    if (isNaN(quantity) || quantity < 0) return toast.error('Stock inválido')
    setSaving(true)
    try {
      const updated = await editListing(id, { title: editForm.title, price, quantity })
      setListings(prev => prev.map(l => l.id === id ? updated : l))
      toast.success('Publicación actualizada en ML ✓')
      setEditingId(null)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al actualizar en ML')
    } finally { setSaving(false) }
  }

  const handleReject = async (id: number) => {
    try {
      const updated = await rejectListing(id)
      setListings(prev => prev.map(l => l.id === id ? updated : l))
      toast('Sugerencia rechazada')
    } catch { toast.error('Error') }
  }

  const pending  = listings.filter(l => l.status === 'pending').length
  const approved = listings.filter(l => l.status === 'approved').length

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'listings',  label: 'Publicaciones',    icon: <ShoppingBag size={14} /> },
    { id: 'questions', label: 'Preguntas',         icon: <MessageSquare size={14} /> },
    { id: 'sales',     label: 'Ventas hoy',        icon: <TrendingUp size={14} /> },
    { id: 'generator', label: 'Nueva publicación', icon: <PlusCircle size={14} /> },
    { id: 'budget',    label: 'Presupuesto IA',    icon: <Zap size={14} /> },
    { id: 'compare',   label: 'Vs Competidor',     icon: <Sparkles size={14} /> },
  ]

  return (
    <div className="page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Mercado Libre</h1>
          <p className="text-sm text-slate-500 mt-1">
            {listings.length} publicaciones · {pending} pendientes · {approved} aprobadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected === false && (
            <button onClick={handleConnect} disabled={connecting} className="btn-secondary text-xs px-3 py-2">
              <Link size={13} />
              <span className="hidden sm:inline">{connecting ? 'Abriendo...' : 'Conectar ML'}</span>
              <span className="sm:hidden">{connecting ? '...' : 'Conectar'}</span>
            </button>
          )}
          {connected === true && (
            <button onClick={handleConnect} disabled={connecting} className="btn-secondary text-xs px-3 py-2">
              <RefreshCw size={13} className={connecting ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{connecting ? 'Abriendo...' : 'Reconectar ML'}</span>
              <span className="sm:hidden">{connecting ? '...' : 'Reconectar'}</span>
            </button>
          )}
          {tab === 'listings' && (
            <button onClick={handleSync} disabled={syncing || connected === false} className="btn-primary text-xs px-3 py-2">
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              <span className="sm:hidden">{syncing ? '...' : 'Sync'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Not connected banner */}
      {connected === false && (
        <div className="card border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 p-5 flex flex-col sm:flex-row items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <Link size={18} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Cuenta de Mercado Libre no conectada</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Hacé clic en <strong>Conectar ML</strong> para autorizar el acceso a tus publicaciones y preguntas.
            </p>
          </div>
          <button onClick={handleConnect} disabled={connecting}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0">
            <Link size={14} />
            {connecting ? 'Abriendo...' : 'Conectar ahora'}
          </button>
        </div>
      )}

      {/* Tab bar — scrollable on mobile, full labels on desktop */}
      <div className="flex gap-1 bg-slate-100/70 p-1 rounded-xl overflow-x-auto scrollbar-hide">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
              tab === t.id
                ? 'bg-white text-brand-accent shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Listings tab ── */}
      {tab === 'listings' && (
        <>
          {loading ? (
            <div className="py-24 text-center text-slate-400 text-sm">Cargando publicaciones...</div>
          ) : listings.length === 0 ? (
            <div className="card py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag size={30} className="text-slate-300" />
              </div>
              <p className="text-slate-600 font-semibold">Sin publicaciones</p>
              <p className="text-slate-400 text-sm mt-1.5">
                {connected === false ? 'Conectá tu cuenta de ML para sincronizar' : 'Hacé clic en Sincronizar para importar'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {listings.map(listing => (
                <div key={listing.id} className="card overflow-hidden hover:shadow-elevated transition-shadow duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-slate-50 bg-slate-50/40">
                    <div className="flex items-center gap-3 min-w-0">
                      {listing.thumbnail ? (
                        <img src={toHttps(listing.thumbnail)} alt="" className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <ShoppingBag size={18} className="text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-medium">ID: {listing.ml_id}</p>
                        <p className="font-semibold text-slate-700 text-sm truncate">{listing.title}</p>
                        {listing.available_quantity !== undefined && listing.available_quantity !== null && (
                          <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                            listing.available_quantity === 0
                              ? 'bg-red-50 text-red-600'
                              : listing.available_quantity <= 3
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {listing.available_quantity === 0 ? 'Sin stock' : `Stock: ${listing.available_quantity} u.`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap shrink-0">
                      <span className="text-base font-bold text-slate-800">
                        ${listing.price.toLocaleString('es-AR')}
                      </span>
                      <span className={STATUS_BADGE[listing.status]}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                        {STATUS_LABEL[listing.status]}
                      </span>
                      {listing.permalink && (
                        <a href={listing.permalink} target="_blank" rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                          <ExternalLink size={13} className="text-slate-500" />
                        </a>
                      )}
                      <button
                        onClick={() => editingId === listing.id ? setEditingId(null) : handleStartEdit(listing)}
                        className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors"
                        title="Editar manualmente"
                      >
                        <Pencil size={13} className="text-blue-500" />
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {editingId === listing.id && (
                    <div className="px-5 py-4 bg-blue-50/50 border-b border-blue-100 space-y-3">
                      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5"><Pencil size={11} /> Editar publicación — los cambios se aplican directo en Mercado Libre</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-3">
                          <label className="label text-[10px]">Título</label>
                          <input
                            className="input text-sm"
                            value={editForm.title}
                            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="label text-[10px]">Precio (ARS)</label>
                          <input
                            type="number"
                            className="input text-sm"
                            value={editForm.price}
                            onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="label text-[10px]">Stock</label>
                          <input
                            type="number"
                            className="input text-sm"
                            min={0}
                            value={editForm.quantity}
                            onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <button
                            onClick={() => handleSaveEdit(listing.id)}
                            disabled={saving}
                            className="btn-primary text-xs px-4 py-2 flex-1 justify-center"
                          >
                            <Save size={13} className={saving ? 'animate-pulse' : ''} />
                            {saving ? 'Guardando...' : 'Guardar en ML'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
                          >
                            <X size={14} className="text-slate-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2">
                    <div className="p-5 space-y-2 border-b sm:border-b-0 sm:border-r border-slate-100">
                      <p className="section-label-text text-[10px]">Original</p>
                      <p className="text-sm font-semibold text-slate-700 leading-snug">{listing.original_title}</p>
                      <p className="text-xs text-slate-500 line-clamp-4 leading-relaxed">
                        {listing.original_description || 'Sin descripción'}
                      </p>
                    </div>

                    <div className={`p-5 space-y-2 ${listing.ai_suggested_title ? 'bg-emerald-50/40' : 'bg-slate-50/40'}`}>
                      <div className="flex items-center gap-1.5">
                        <Zap size={11} className="text-brand-accent" />
                        <p className="section-label-text text-[10px]">Propuesta IA</p>
                      </div>
                      {listing.ai_suggested_title ? (
                        <>
                          <p className="text-sm font-semibold text-brand-accent leading-snug">{listing.ai_suggested_title}</p>
                          <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed">{listing.ai_suggested_description}</p>
                          {listing.ai_improvements && (
                            <p className="text-xs text-brand-mid italic mt-1 leading-relaxed">💡 {listing.ai_improvements}</p>
                          )}
                        </>
                      ) : (
                        <div className="pt-1">
                          <button
                            onClick={() => handleOptimize(listing.id)}
                            disabled={optimizing === listing.id}
                            className="btn-primary text-xs px-3.5 py-2"
                          >
                            <Sparkles size={13} className={optimizing === listing.id ? 'animate-pulse' : ''} />
                            {optimizing === listing.id ? 'Optimizando...' : 'Optimizar con IA'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {listing.status === 'pending' && (
                    <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-slate-100 bg-slate-50/30">
                      <button
                        onClick={() => handleReject(listing.id)}
                        className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-semibold px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
                      >
                        <X size={14} /> Rechazar
                      </button>
                      <button
                        onClick={() => handleApprove(listing.id)}
                        disabled={approving === listing.id}
                        className="btn-primary text-sm px-4 py-2"
                      >
                        <Check size={14} />
                        {approving === listing.id ? 'Aplicando...' : 'Aprobar y publicar'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Questions tab ── */}
      {tab === 'questions' && <QuestionsPanel connected={connected} />}

      {/* ── Sales tab ── */}
      {tab === 'sales' && <SalesPanel connected={connected} onReconnect={handleConnect} />}

      {/* ── Generator tab ── */}
      {tab === 'generator' && <GeneratorPanel connected={connected} />}

      {/* ── Budget Analysis tab ── */}
      {tab === 'budget' && <BudgetPanel />}

      {/* ── Competitor Comparison tab ── */}
      {tab === 'compare' && <ComparePanel listings={listings} />}
    </div>
  )
}

// ── Budget Analysis Panel ─────────────────────────────────────
function BudgetPanel() {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const analyze = async () => {
    setLoading(true)
    try {
      const res = await getMLBudgetAnalysis()
      setData(res)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al analizar')
    } finally { setLoading(false) }
  }

  const PRIORIDAD_COLOR: Record<string, string> = {
    alta: 'bg-red-50 text-red-700 border-red-200',
    media: 'bg-amber-50 text-amber-700 border-amber-200',
    baja: 'bg-slate-50 text-slate-600 border-slate-200',
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-xl bg-brand-accent/10 flex items-center justify-center">
            <Zap size={16} className="text-brand-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Análisis de presupuesto IA</p>
            <p className="text-xs text-slate-400">Claude analiza tus publicaciones y sugiere dónde invertir en ML Ads</p>
          </div>
        </div>
        <button onClick={analyze} disabled={loading} className="btn-primary w-full justify-center">
          <Sparkles size={14} className={loading ? 'animate-pulse' : ''} />
          {loading ? 'Analizando con IA...' : 'Analizar mi portfolio'}
        </button>
      </div>

      {data && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Resumen</p>
            <p className="text-sm text-slate-700 leading-relaxed">{data.resumen}</p>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recomendaciones por publicación</p>
            </div>
            <div className="divide-y divide-slate-50">
              {(data.recomendaciones || []).map((r: any, i: number) => (
                <div key={i} className="px-5 py-3.5 flex items-start gap-3">
                  <span className={`mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORIDAD_COLOR[r.prioridad] || PRIORIDAD_COLOR.baja}`}>
                    {r.prioridad?.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{r.titulo}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.razon}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-brand-accent">{r.presupuesto_sugerido_pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 border-brand-accent/20 bg-brand-pale/30">
            <p className="text-xs font-bold text-brand-accent uppercase tracking-widest mb-2">Estrategia recomendada</p>
            <p className="text-sm text-slate-700 leading-relaxed">{data.estrategia}</p>
          </div>

          {data.advertencias && (
            <div className="card p-4 border-amber-200 bg-amber-50/40">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Advertencias</p>
              <p className="text-sm text-amber-800 leading-relaxed">{data.advertencias}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Competitor Comparison Panel ───────────────────────────────
function ComparePanel({ listings }: { listings: Listing[] }) {
  const [listingId, setListingId]   = useState(0)
  const [compUrl, setCompUrl]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<any>(null)

  const compare = async () => {
    if (!compUrl.trim()) return toast.error('Ingresá la URL del competidor')
    setLoading(true)
    try {
      const res = await compareMLListing(listingId, compUrl)
      setResult(res)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Error al comparar')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
            <Sparkles size={16} className="text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Comparar vs competidor</p>
            <p className="text-xs text-slate-400">IA analiza precio, título, descripción y posicionamiento</p>
          </div>
        </div>

        <div>
          <label className="label">Tu publicación (opcional)</label>
          <select value={listingId} onChange={e => setListingId(Number(e.target.value))} className="input">
            <option value={0}>— Solo analizar el competidor —</option>
            {listings.map(l => <option key={l.id} value={l.id}>{l.title?.slice(0, 60)}</option>)}
          </select>
        </div>

        <div>
          <label className="label">URL de la publicación del competidor</label>
          <input className="input" placeholder="https://www.mercadolibre.com.ar/..." value={compUrl} onChange={e => setCompUrl(e.target.value)} />
        </div>

        <button onClick={compare} disabled={loading} className="btn-primary w-full justify-center">
          <Sparkles size={14} className={loading ? 'animate-pulse' : ''} />
          {loading ? 'Analizando...' : 'Comparar con IA'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          {/* Score */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-400 mb-1">Tu puntaje</p>
              <p className="text-3xl font-bold text-brand-accent">{result.puntaje_nuestro ?? '—'}<span className="text-sm text-slate-400">/10</span></p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-slate-400 mb-1">Competidor</p>
              <p className="text-3xl font-bold text-slate-600">{result.puntaje_competidor ?? '—'}<span className="text-sm text-slate-400">/10</span></p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{result.competitor_title?.slice(0, 30)}</p>
            </div>
          </div>

          {/* Priority action */}
          {result.accion_prioritaria && (
            <div className="card p-4 border-red-200 bg-red-50/40">
              <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">Acción prioritaria</p>
              <p className="text-sm text-red-800 font-medium">{result.accion_prioritaria}</p>
            </div>
          )}

          {/* Title */}
          {result.titulo && (
            <div className="card p-4 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Análisis de título</p>
              <p className="text-sm text-slate-700">{result.titulo.analisis}</p>
              {result.titulo.sugerencia_mejora && (
                <div className="bg-brand-pale rounded-xl px-3 py-2">
                  <p className="text-[10px] font-bold text-brand-accent mb-0.5">TÍTULO SUGERIDO</p>
                  <p className="text-sm font-semibold text-brand-accent">{result.titulo.sugerencia_mejora}</p>
                </div>
              )}
            </div>
          )}

          {/* Pros / Cons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.ventajas_competidor?.length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Ventajas del competidor</p>
                <ul className="space-y-1">
                  {result.ventajas_competidor.map((v: string, i: number) => (
                    <li key={i} className="text-xs text-slate-700 flex gap-1.5"><span className="text-red-400 mt-0.5">▸</span>{v}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.desventajas_competidor?.length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Debilidades del competidor</p>
                <ul className="space-y-1">
                  {result.desventajas_competidor.map((v: string, i: number) => (
                    <li key={i} className="text-xs text-slate-700 flex gap-1.5"><span className="text-emerald-400 mt-0.5">▸</span>{v}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Description */}
          {result.descripcion && (
            <div className="card p-4 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Descripción</p>
              <p className="text-sm text-slate-700">{result.descripcion.analisis}</p>
              {result.descripcion.sugerencia && (
                <p className="text-xs text-brand-accent italic">{result.descripcion.sugerencia}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
