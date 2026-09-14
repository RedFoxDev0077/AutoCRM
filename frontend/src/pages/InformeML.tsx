import { useEffect, useRef, useState } from 'react'
import {
  FileSpreadsheet, RefreshCw, Download, Upload, AlertTriangle, CheckCircle2, Clock, Lightbulb,
  TrendingUp, Target, MousePointerClick, ShoppingCart, Megaphone, Percent, ChevronLeft, ChevronRight, History, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/client'

type Accion = { prioridad: 'Alta' | 'Media' | 'Baja'; tema: string; observado: string; accion: string }
type Summary = {
  metricas?: Record<string, number | null>
  alertas?: Record<string, number>
  destacados?: string[]
  acciones?: Accion[]
  errores?: { seccion: string; detalle: string }[]
  anuncios?: number
  comparado_con?: string | null
}
type Report = {
  id: number; run_date: string; trigger: string; status: 'running' | 'ok' | 'parcial' | 'error'
  created_at: string; finished_at: string | null; has_file: boolean; summary: Summary
}
type Historial = { fecha: string; anuncios: number; posiciones: number }
type State = { connected: boolean; running: boolean; next_run: string; history_dates: number; historial: Historial[]; reports: Report[] }
type ImportResult = { archivo: string; ok: boolean; texto: string }

const PAGE_SIZE = 5

const money = (n?: number | null) =>
  n == null ? '—' : '$ ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
const num = (n?: number | null, d = 0) =>
  n == null ? '—' : n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
const fechaCorta = (ymd: string) => ymd.split('-').reverse().join('/')

const STATUS: Record<Report['status'], { label: string; cls: string }> = {
  running: { label: 'Generando…', cls: 'badge bg-blue-50 text-blue-700 border-blue-100' },
  ok:      { label: 'Completo',   cls: 'badge-approved' },
  parcial: { label: 'Parcial',    cls: 'badge-pending' },
  error:   { label: 'Con error',  cls: 'badge-rejected' },
}
const PRIO: Record<Accion['prioridad'], string> = {
  Alta: 'bg-red-50 text-red-700 border-red-100',
  Media: 'bg-amber-50 text-amber-700 border-amber-100',
  Baja: 'bg-slate-50 text-slate-600 border-slate-200',
}
const ALERTAS: [string, string][] = [
  ['sin_stock', 'Sin stock'], ['para_corregir', 'Por corregir'], ['en_revision', 'En revisión'],
  ['calidad_baja', 'Calidad < 70'], ['stock_bajo', 'Stock bajo'], ['pausadas', 'Pausadas'], ['inactivas', 'Inactivas'],
]

async function descargar(r: Report) {
  try {
    const res = await api.get(`/ml-report/${r.id}/excel`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `ML_informe_${r.run_date}.xlsx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch {
    toast.error('No se pudo descargar el Excel')
  }
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof TrendingUp; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        <Icon size={14} />
        <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-800 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function HistorialCard({ items }: { items: Historial[] }) {
  return (
    <div className="card p-5 self-start">
      <div className="flex items-center gap-2 mb-3">
        <History size={15} className="text-slate-400" />
        <h3 className="font-semibold text-slate-800 text-sm">Histórico cargado</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">
          Todavía no hay datos. Importá «Historico ML - acumulado.csv» y «Posiciones ML - acumulado.csv», o esperá la primera corrida.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map(h => (
            <li key={h.fecha} className="flex items-center justify-between text-sm">
              <span className="text-slate-700 tabular-nums">{fechaCorta(h.fecha)}</span>
              <span className="text-xs text-slate-400 tabular-nums">{h.anuncios} anuncios · {h.posiciones} posiciones</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function InformeML() {
  const [state, setState] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [resultados, setResultados] = useState<ImportResult[]>([])
  const [page, setPage] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const { data } = await api.get<State>('/ml-report')
      setState(data)
    } catch {
      toast.error('No se pudo cargar el informe')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // a new report starts again on the first page of actions
  const lastId = state?.reports.find(r => r.status !== 'running')?.id
  useEffect(() => { setPage(0) }, [lastId])

  // while a report is being generated, check every 5 seconds
  useEffect(() => {
    if (!state?.running && state?.reports[0]?.status !== 'running') return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [state?.running, state?.reports[0]?.status])

  const generar = async () => {
    try {
      await api.post('/ml-report/run')
      toast.success('Generando el informe. Tarda uno o dos minutos.')
      setTimeout(load, 800)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo iniciar el informe')
    }
  }

  const importar = async (files: FileList | null) => {
    if (!files?.length) return
    setImporting(true)
    setResultados([])
    const res: ImportResult[] = []
    for (const f of Array.from(files)) {
      try {
        const body = new FormData()
        body.append('file', f)
        const { data } = await api.post('/ml-report/historial', body)
        const tipo = data.tipo === 'posiciones' ? 'posiciones' : 'filas de anuncios'
        res.push({
          archivo: f.name, ok: true,
          texto: data.importadas
            ? `Se importaron ${data.importadas} ${tipo}${data.omitidas ? ` (${data.omitidas} ya estaban cargadas)` : ''}.`
            : `No había nada nuevo: las ${data.omitidas} filas ya estaban cargadas.`,
        })
      } catch (e: any) {
        res.push({ archivo: f.name, ok: false, texto: e?.response?.data?.detail ?? 'No se pudo importar el archivo.' })
      }
    }
    setResultados(res)
    const bien = res.filter(r => r.ok).length
    if (bien === res.length) toast.success(bien === 1 ? 'Archivo importado' : `${bien} archivos importados`)
    else toast.error('Algún archivo no se pudo importar')
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  const last = state?.reports.find(r => r.status !== 'running')
  const acciones = last?.summary.acciones ?? []
  const pages = Math.max(1, Math.ceil(acciones.length / PAGE_SIZE))
  const pageSafe = Math.min(page, pages - 1)
  const visibles = acciones.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE)
  const running = state?.running || state?.reports[0]?.status === 'running'
  const m = last?.summary.metricas ?? {}

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FFE600] flex items-center justify-center">
            <FileSpreadsheet size={18} className="text-slate-800" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Informe Mercado Libre</h1>
            <p className="text-sm text-slate-500">
              Se arma solo los lunes y jueves a las 8:00
              {state?.next_run && <> · próximo: {fechaLarga(state.next_run)}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv" multiple hidden onChange={e => importar(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary text-sm">
            <Upload size={14} /> {importing ? 'Importando…' : 'Importar histórico (CSV)'}
          </button>
          <button onClick={generar} disabled={!!running || !state?.connected} className="btn-primary text-sm">
            <RefreshCw size={14} className={running ? 'animate-spin' : ''} /> {running ? 'Generando…' : 'Generar ahora'}
          </button>
        </div>
      </div>

      {state && !state.connected && (
        <div className="card p-4 flex gap-3 items-start border-amber-100 bg-amber-50/60">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            Mercado Libre no está conectado, así que el informe no puede leer datos. Conectalo desde la sección <b>Mercado Libre</b>.
          </p>
        </div>
      )}

      {resultados.length > 0 && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Resultado de la importación</p>
            <button onClick={() => setResultados([])} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Cerrar">
              <X size={15} />
            </button>
          </div>
          {resultados.map((r, i) => (
            <div key={i} className={`flex gap-2 items-start rounded-xl px-3 py-2 text-sm ${r.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
              {r.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
              <span><b>{r.archivo}:</b> {r.texto}</span>
            </div>
          ))}
        </div>
      )}

      {importing && (
        <div className="card p-4 flex items-center gap-2 text-sm text-slate-600">
          <RefreshCw size={14} className="animate-spin" /> Importando el histórico…
        </div>
      )}

      {loading && <div className="card p-10 text-center text-slate-400 text-sm">Cargando…</div>}

      {!loading && !last && !running && (
        <div className="grid lg:grid-cols-3 gap-5">
        <div className="card p-10 text-center space-y-2 lg:col-span-2">
          <FileSpreadsheet size={28} className="mx-auto text-slate-300" />
          <p className="text-slate-600 font-medium">Todavía no hay informes</p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            El primero se genera el próximo lunes o jueves. Si tenés los CSV que acumulaba la tarea de Claude, importalos antes para que
            el informe compare contra esas corridas.
          </p>
        </div>
        <HistorialCard items={state?.historial ?? []} />
        </div>
      )}

      {last && (
        <>
          {/* Latest report */}
          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-800">Informe del {fechaCorta(last.run_date)}</h2>
                  <span className={STATUS[last.status].cls}>{STATUS[last.status].label}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {last.trigger === 'programado' ? 'Generado automáticamente' : 'Generado a mano'}
                  {last.summary.comparado_con && <> · comparado con la corrida del {fechaCorta(last.summary.comparado_con)}</>}
                  {last.summary.anuncios != null && <> · {last.summary.anuncios} anuncios</>}
                </p>
              </div>
              {last.has_file && (
                <button onClick={() => descargar(last)} className="btn-primary text-sm">
                  <Download size={14} /> Descargar Excel
                </button>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Lightbulb size={14} />
                <span className="text-xs font-semibold uppercase tracking-widest">Lo más importante</span>
              </div>
              <ul className="space-y-1.5">
                {(last.summary.destacados ?? []).map((h, i) => (
                  <li key={i} className="text-sm text-slate-700 leading-relaxed flex gap-2">
                    <span className="text-slate-300">•</span><span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!!last.summary.errores?.length && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1">No se pudo leer</p>
                <ul className="space-y-0.5">
                  {last.summary.errores.map((e, i) => (
                    <li key={i} className="text-xs text-amber-800"><b>{e.seccion}:</b> {e.detalle}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {last.summary.metricas && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Tile icon={Megaphone} label="Inversión Ads" value={money(m.inversion_product_ads)} sub="últimos 30 días" />
              <Tile icon={TrendingUp} label="Ingresos por Ads" value={money(m.ingresos_publicidad)} />
              <Tile icon={Target} label="ROAS" value={num(m.roas, 1)} sub={`ACOS ${num(m.acos, 1)} %`} />
              <Tile icon={Percent} label="TACOS" value={`${num(m.tacos, 1)} %`} sub="inversión ÷ facturación" />
              <Tile icon={ShoppingCart} label="Ventas atribuidas" value={num(m.ventas_atribuidas)} />
              <Tile icon={MousePointerClick} label="Clics" value={num(m.clics)} />
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Actions */}
            <div className="card lg:col-span-2 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">Acciones sugeridas</h3>
                <span className="text-xs text-slate-400">{acciones.length}</span>
              </div>
              {acciones.length === 0 ? (
                <p className="p-5 text-sm text-slate-400">Sin acciones urgentes en esta corrida.</p>
              ) : (
                <>
                <ul className="divide-y divide-slate-100">
                  {visibles.map((a, i) => (
                    <li key={i} className="px-5 py-3 flex gap-3">
                      <span className={`badge h-fit shrink-0 ${PRIO[a.prioridad]}`}>{a.prioridad}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{a.tema}</p>
                        <p className="text-sm text-slate-600">{a.observado}</p>
                        <p className="text-xs text-slate-400 mt-0.5">→ {a.accion}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {pages > 1 && (
                  <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500 tabular-nums">
                      {pageSafe * PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAGE_SIZE, acciones.length)} de {acciones.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(pageSafe - 1)} disabled={pageSafe === 0}
                        className="btn-ghost text-xs px-2 py-1.5 disabled:opacity-40" aria-label="Página anterior">
                        <ChevronLeft size={14} />
                      </button>
                      {Array.from({ length: pages }, (_, i) => (
                        <button key={i} onClick={() => setPage(i)} aria-current={i === pageSafe ? 'page' : undefined}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold tabular-nums transition-colors ${i === pageSafe ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                          {i + 1}
                        </button>
                      ))}
                      <button onClick={() => setPage(pageSafe + 1)} disabled={pageSafe >= pages - 1}
                        className="btn-ghost text-xs px-2 py-1.5 disabled:opacity-40" aria-label="Página siguiente">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}
            </div>

            {/* Catalog alerts + loaded history */}
            <div className="space-y-5 self-start">
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-3">Alertas del catálogo</h3>
              <ul className="space-y-2">
                {ALERTAS.filter(([k]) => last.summary.alertas?.[k] != null).map(([k, label]) => {
                  const v = last.summary.alertas![k]
                  return (
                    <li key={k} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{label}</span>
                      <span className={`font-semibold tabular-nums ${v ? 'text-slate-800' : 'text-slate-300'}`}>{v}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
            <HistorialCard items={state?.historial ?? []} />
            </div>
          </div>
        </>
      )}

      {/* Previous runs */}
      {state && state.reports.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">Corridas</h3>
            <span className="text-xs text-slate-400">{state.history_dates} fechas en el histórico</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {state.reports.map(r => (
              <li key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                {r.status === 'error' ? <AlertTriangle size={15} className="text-red-500" />
                  : r.status === 'running' ? <Clock size={15} className="text-blue-500" />
                  : <CheckCircle2 size={15} className="text-emerald-500" />}
                <span className="text-sm font-medium text-slate-700 w-24">{fechaCorta(r.run_date)}</span>
                <span className={STATUS[r.status].cls}>{STATUS[r.status].label}</span>
                <span className="text-xs text-slate-400 flex-1 min-w-[10rem] truncate">{r.summary.destacados?.[0] ?? ''}</span>
                {r.has_file && (
                  <button onClick={() => descargar(r)} className="btn-ghost text-xs">
                    <Download size={13} /> Excel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
