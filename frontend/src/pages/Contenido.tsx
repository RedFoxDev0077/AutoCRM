import { useState, useRef } from 'react'
import { Sparkles, Copy, Check, RefreshCw, Clock, Calendar, Zap, ChevronDown, ChevronUp, Upload, Send, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react'
import api from '../api/client'

const PRODUCTS = [
  'Pantalones de trabajo',
  'Pantalón cargo de trabajo',
  'Buzos de friza',
  'Camperas trucker',
  'Mamelucos',
  'Ambos médicos',
  'Remeras',
  'Camisas gabardina',
  'Línea completa',
]
const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'ambas',     label: 'IG + FB' },
]
const TONES = [
  { value: 'profesional',      label: 'Profesional' },
  { value: 'descontracturado', label: 'Descontracturado' },
  { value: 'urgente',          label: 'Urgente / Oferta' },
  { value: 'informativo',      label: 'Informativo' },
]
const GOALS = [
  { value: 'ventas',     label: 'Generar ventas' },
  { value: 'branding',   label: 'Fortalecer marca' },
  { value: 'engagement', label: 'Aumentar interacción' },
]

interface PostResult { post: string; hashtags: string; cta: string; historia: string; best_times: string }
interface DayPlan { day: string; tipo: string; foco: string; copy: string; hashtags: string; horario: string }
interface CampaignResult { days: DayPlan[]; ab_variations: string; tips: string; best_times: string }

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 transition-all">
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function Card({ title, content, accent }: { title: string; content: string; accent?: boolean }) {
  if (!content) return null
  return (
    <div className={`bg-white rounded-2xl border ${accent ? 'border-purple-200' : 'border-slate-100'} p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</span>
        <CopyBtn text={content} />
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  )
}

function BestTimeBadge({ times }: { times: string }) {
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
      <Clock size={13} className="text-amber-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Mejor horario para publicar</p>
        <p className="text-xs text-amber-700">{times}</p>
      </div>
    </div>
  )
}

function FormPanel({ product, setProduct, platform, setPlatform, tone, setTone, context, setContext, budget, setBudget, imageUrl, setImageUrl }: any) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]     = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')

  const handleFile = async (file: File) => {
    setUploadErr(''); setPreview(URL.createObjectURL(file)); setUploading(true)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await api.post('/social/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImageUrl(res.data.url)
    } catch (e: any) { setUploadErr(e?.response?.data?.detail || 'Error al subir'); setPreview(''); setImageUrl('') }
    finally { setUploading(false) }
  }

  return (
    <>
      {/* ── Image upload ── */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Foto del producto <span className="font-normal text-slate-400">(opcional)</span></label>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${preview ? 'border-purple-300 bg-purple-50' : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'}`}
        >
          {preview ? (
            <div className="relative w-full flex items-center gap-3">
              <img src={preview} alt="preview" className="h-16 w-16 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-purple-700 truncate">Imagen lista</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Tocá para cambiarla</p>
              </div>
              {uploading && <RefreshCw size={13} className="animate-spin text-purple-400 shrink-0" />}
              {!uploading && imageUrl && <CheckCircle size={13} className="text-green-500 shrink-0" />}
            </div>
          ) : (
            <>
              <Upload size={20} className="text-slate-300 mb-1.5" />
              <p className="text-xs text-slate-400">Arrastrá o hacé click para subir</p>
              <p className="text-[10px] text-slate-300 mt-0.5">JPG, PNG o WEBP</p>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
        </div>
        {uploadErr && <p className="text-xs text-red-500 mt-1">{uploadErr}</p>}
      </div>

      {/* ── Producto ── */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Producto</label>
        <input
          list="product-suggestions"
          value={product}
          onChange={e => setProduct(e.target.value)}
          placeholder="Ej: Pantalón cargo, campera, remera..."
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-slate-400"
        />
        <datalist id="product-suggestions">
          {PRODUCTS.map(p => <option key={p} value={p} />)}
        </datalist>
      </div>

      {/* ── Plataforma ── */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Plataforma</label>
        <div className="flex gap-2">
          {PLATFORMS.map(p => (
            <button key={p.value} onClick={() => setPlatform(p.value)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${platform === p.value ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tono ── */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tono</label>
        <div className="grid grid-cols-2 gap-2">
          {TONES.map(t => (
            <button key={t.value} onClick={() => setTone(t.value)}
              className={`py-2 rounded-xl text-xs font-semibold border transition-all ${tone === t.value ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Presupuesto ── */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Presupuesto de campaña <span className="font-normal text-slate-400">(ARS, opcional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">$</span>
          <input
            type="number"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            placeholder="Ej: 50000"
            className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-slate-400"
          />
        </div>
      </div>

      {/* ── Contexto ── */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Contexto <span className="font-normal text-slate-400">(opcional)</span>
        </label>
        <textarea value={context} onChange={e => setContext(e.target.value)} rows={2}
          placeholder="Ej: descuento 20%, stock limitado, nueva colección..."
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-slate-400" />
      </div>
    </>
  )
}

// ── Publish Section ────────────────────────────────────────────────────────

function PublishSection({ caption, platform, preloadedImageUrl = '', budgetArs = 0 }: { caption: string; platform: string; preloadedImageUrl?: string; budgetArs?: number }) {
  const [imageUrl, setImageUrl] = useState(preloadedImageUrl)
  const [preview, setPreview]   = useState(preloadedImageUrl ? '(imagen cargada desde el formulario)' : '')
  const [uploading, setUploading]   = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [results, setResults]       = useState<Record<string, any> | null>(null)
  const [uploadError, setUploadError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync if parent uploaded a new image
  const effectiveUrl = preloadedImageUrl || imageUrl

  const handleFile = async (file: File) => {
    setUploadError(''); setResults(null)
    setPreview(URL.createObjectURL(file)); setUploading(true)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await api.post('/social/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImageUrl(res.data.url)
    } catch (e: any) { setUploadError(e?.response?.data?.detail || 'Error al subir imagen'); setPreview('') }
    finally { setUploading(false) }
  }

  const publish = async () => {
    if (!effectiveUrl) return
    setPublishing(true); setResults(null)
    try {
      const res = await api.post('/social/publish', { caption, image_url: effectiveUrl, platform, budget_ars: budgetArs || 0 })
      setResults(res.data)
    } catch (e: any) { setResults({ error: e?.response?.data?.detail || 'Error al publicar' }) }
    finally { setPublishing(false) }
  }

  const igOk = results?.instagram?.success
  const fbOk = results?.facebook?.success

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Send size={13} className="text-purple-500" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Publicar directamente</span>
      </div>

      {preloadedImageUrl ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
          <CheckCircle size={13} className="text-green-500 shrink-0" />
          <p className="text-xs text-green-700">Imagen cargada desde el formulario — lista para publicar</p>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${preview ? 'border-purple-300 bg-purple-50' : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'}`}
        >
          {preview ? (
            <img src={preview} alt="preview" className="max-h-32 rounded-lg object-cover" />
          ) : (
            <>
              <ImageIcon size={24} className="text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">Hacé click para subir una foto</p>
              <p className="text-[10px] text-slate-300 mt-0.5">JPG, PNG o WEBP</p>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
        </div>
      )}

      {uploading && <p className="text-xs text-purple-500 text-center flex items-center justify-center gap-1"><RefreshCw size={11} className="animate-spin" /> Subiendo imagen...</p>}
      {uploadError && <p className="text-xs text-red-500 text-center">{uploadError}</p>}

      {effectiveUrl && !uploading && (
        <button onClick={publish} disabled={publishing}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all">
          {publishing ? <><RefreshCw size={13} className="animate-spin" /> Publicando...</> : <><Send size={13} /> Publicar en {platform === 'ambas' ? 'IG + FB' : platform === 'instagram' ? 'Instagram' : 'Facebook'}</>}
        </button>
      )}

      {results && (
        <div className="space-y-1.5">
          {results.error && <p className="text-xs text-red-500 text-center">{results.error}</p>}
          {results.instagram && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${igOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {igOk ? <CheckCircle size={13} /> : <XCircle size={13} />}
              Instagram: {igOk ? 'Publicado correctamente' : results.instagram.error}
            </div>
          )}
          {results.facebook && (
            <div className={`text-xs px-3 py-2 rounded-xl ${fbOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              <div className="flex items-center gap-2">
                {fbOk ? <CheckCircle size={13} /> : <XCircle size={13} />}
                Facebook: {fbOk ? 'Publicado correctamente' : results.facebook.error}
              </div>
              {results.facebook.boost?.boosted && (
                <div className="mt-1 ml-5 font-semibold">
                  🚀 Anuncio activo — presupuesto diario: ${Number(results.facebook.boost.daily_budget_ars).toLocaleString('es-AR')} ARS
                </div>
              )}
              {results.facebook.boost?.error && (
                <div className="mt-1 ml-5 text-amber-600">{results.facebook.boost.error}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Post único ─────────────────────────────────────────────────────────────

function PostTab() {
  const [product,  setProduct]  = useState('Pantalones de trabajo')
  const [platform, setPlatform] = useState('instagram')
  const [tone,     setTone]     = useState('profesional')
  const [context,  setContext]  = useState('')
  const [budget,   setBudget]   = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<PostResult | null>(null)
  const [error,    setError]    = useState('')

  const generate = async () => {
    setLoading(true); setError('')
    const fullContext = [context, budget ? `Presupuesto disponible: $${Number(budget).toLocaleString('es-AR')} ARS` : ''].filter(Boolean).join('. ')
    try { const res = await api.post('/social/content', { product, platform, tone, context: fullContext }); setResult(res.data) }
    catch (e: any) { setError(e?.response?.data?.detail || 'Error') }
    finally { setLoading(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
        <FormPanel {...{ product, setProduct, platform, setPlatform, tone, setTone, context, setContext, budget, setBudget, imageUrl, setImageUrl }} />
        <button onClick={generate} disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all">
          {loading ? <><RefreshCw size={15} className="animate-spin" /> Generando...</> : <><Sparkles size={15} /> Generar post</>}
        </button>
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      </div>

      <div className="space-y-3">
        {!result && !loading && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 flex flex-col items-center justify-center text-center min-h-[260px]">
            <Sparkles size={28} className="text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">El contenido aparecerá aquí</p>
          </div>
        )}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 flex flex-col items-center justify-center min-h-[260px]">
            <RefreshCw size={24} className="animate-spin text-purple-400 mb-3" />
            <p className="text-sm text-slate-500">Generando con IA...</p>
          </div>
        )}
        {result && !loading && (
          <>
            {result.best_times && <BestTimeBadge times={result.best_times} />}
            <Card title="Post"           content={result.post}     accent />
            <Card title="Hashtags"       content={result.hashtags} />
            <Card title="Call to Action" content={result.cta} />
            <Card title="Historia"       content={result.historia} />
            <PublishSection
              caption={[result.post, result.hashtags].filter(Boolean).join('\n\n')}
              platform={platform}
              preloadedImageUrl={imageUrl}
              budgetArs={Number(budget) || 0}
            />
            <button onClick={generate} className="w-full text-xs text-slate-400 hover:text-purple-600 flex items-center justify-center gap-1.5 py-2 transition-colors">
              <RefreshCw size={11} /> Regenerar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Campaña ────────────────────────────────────────────────────────────────

function DayCard({ plan }: { plan: DayPlan }) {
  const [open, setOpen] = useState(false)
  const full = [plan.copy, plan.hashtags].filter(Boolean).join('\n\n')
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-purple-600">D{plan.day}</span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-700">{plan.tipo || 'Post'}</p>
            <p className="text-xs text-slate-400">{plan.foco}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {plan.horario && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-1">
              <Clock size={10} /> {plan.horario}
            </span>
          )}
          {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-50 px-4 py-3 space-y-3">
          {plan.copy && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Copy</span>
                <CopyBtn text={full} />
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{plan.copy}</p>
            </div>
          )}
          {plan.hashtags && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hashtags</span>
              <p className="text-xs text-slate-500 mt-1">{plan.hashtags}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CampaignTab() {
  const [product,  setProduct]  = useState('Pantalones de trabajo')
  const [platform, setPlatform] = useState('instagram')
  const [goal,     setGoal]     = useState('ventas')
  const [days,     setDays]     = useState(7)
  const [context,  setContext]  = useState('')
  const [budget,   setBudget]   = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<CampaignResult | null>(null)
  const [error,    setError]    = useState('')

  const generate = async () => {
    setLoading(true); setError('')
    const fullContext = [context, budget ? `Presupuesto disponible: $${Number(budget).toLocaleString('es-AR')} ARS` : ''].filter(Boolean).join('. ')
    try { const res = await api.post('/social/campaign', { product, platform, goal, days, context: fullContext }); setResult(res.data) }
    catch (e: any) { setError(e?.response?.data?.detail || 'Error') }
    finally { setLoading(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
        <FormPanel {...{ product, setProduct, platform, setPlatform, tone: 'profesional', setTone: () => {}, context, setContext, budget, setBudget, imageUrl, setImageUrl }} />
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Objetivo</label>
          <div className="space-y-2">
            {GOALS.map(g => (
              <button key={g.value} onClick={() => setGoal(g.value)}
                className={`w-full py-2 rounded-xl text-xs font-semibold border transition-all ${goal === g.value ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Duración</label>
          <div className="flex gap-2">
            {[7, 14].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${days === d ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                {d} días
              </button>
            ))}
          </div>
        </div>
        <button onClick={generate} disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all">
          {loading ? <><RefreshCw size={15} className="animate-spin" /> Generando campaña...</> : <><Calendar size={15} /> Generar campaña {days} días</>}
        </button>
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      </div>

      <div className="space-y-3">
        {!result && !loading && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
            <Calendar size={28} className="text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">La campaña generada aparecerá aquí</p>
            <p className="text-xs text-slate-400 mt-1">Incluye calendario día a día, variaciones A/B y tips de optimización</p>
          </div>
        )}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 flex flex-col items-center justify-center min-h-[300px]">
            <RefreshCw size={24} className="animate-spin text-purple-400 mb-3" />
            <p className="text-sm text-slate-500">Armando campaña de {days} días...</p>
            <p className="text-xs text-slate-400 mt-1">Esto puede tardar unos segundos</p>
          </div>
        )}
        {result && !loading && (
          <>
            {result.best_times && <BestTimeBadge times={result.best_times} />}
            <div className="space-y-2">
              {result.days.map(d => <DayCard key={d.day} plan={d} />)}
            </div>
            {result.ab_variations && (
              <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={13} className="text-blue-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Variaciones A/B</span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{result.ab_variations}</p>
              </div>
            )}
            {result.tips && (
              <div className="bg-white rounded-2xl border border-green-100 p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tips de optimización</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{result.tips}</p>
              </div>
            )}
            <button onClick={generate} className="w-full text-xs text-slate-400 hover:text-purple-600 flex items-center justify-center gap-1.5 py-2 transition-colors">
              <RefreshCw size={11} /> Regenerar campaña
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Contenido() {
  const [tab, setTab] = useState<'post' | 'campaign'>('post')

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Contenido IA</h1>
          <p className="text-sm text-slate-500">Generá posts y campañas para Instagram y Facebook</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {[
          { key: 'post',     label: 'Post único' },
          { key: 'campaign', label: 'Campaña completa' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'post'     && <PostTab />}
      {tab === 'campaign' && <CampaignTab />}
    </div>
  )
}
