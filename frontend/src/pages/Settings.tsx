import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, RefreshCw, Zap, MessageCircle, MapPin, ShoppingBag, Bot, Activity, Instagram, Save, Key, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { getKommoStatus, getWhatsappStatus, getGoogleStatus, getMLStatus, getClaudeStatus, getMetaStatus, saveMetaConfig, getBusinessContext, saveBusinessContext } from '../api/client'

interface ServiceStatus { connected: boolean }

const services = [
  { key: 'kommo',  name: 'Kommo CRM',             desc: 'Embudos, Salesbot y gestión de leads',        icon: Activity,       gradient: 'from-violet-400 to-violet-500' },
  { key: 'wa',     name: 'WhatsApp Business API',  desc: 'Mensajes, webhooks y plantillas Meta',        icon: MessageCircle,  gradient: 'from-emerald-400 to-emerald-500' },
  { key: 'google', name: 'Google Places API',      desc: 'Captación de leads desde Google Maps',        icon: MapPin,         gradient: 'from-blue-400 to-blue-500' },
  { key: 'ml',     name: 'Mercado Libre API',       desc: 'Sincronización y publicación de listings',    icon: ShoppingBag,    gradient: 'from-amber-400 to-amber-500' },
  { key: 'claude', name: 'Claude AI (Anthropic)',   desc: 'Optimización de títulos y descripciones IA',  icon: Bot,            gradient: 'from-orange-400 to-rose-500' },
  { key: 'meta',   name: 'Meta (Instagram + FB)',   desc: 'Publicación directa de posts desde el panel', icon: Instagram,      gradient: 'from-pink-400 to-purple-500' },
]

export default function Settings() {
  const [statuses, setStatuses] = useState<Record<string, ServiceStatus | null>>({ kommo: null, wa: null, google: null, ml: null, claude: null, meta: null })
  const [checking, setChecking] = useState(false)
  const [metaForm, setMetaForm] = useState({ access_token: '', page_id: '', ig_account_id: '', ad_account_id: '' })
  const [savingMeta, setSavingMeta] = useState(false)
  const [bizContext, setBizContext] = useState('')
  const [savingCtx, setSavingCtx] = useState(false)

  const handleSaveContext = async () => {
    setSavingCtx(true)
    try {
      await saveBusinessContext(bizContext)
      toast.success('Contexto guardado — la IA lo usará en los próximos posts')
    } catch {
      toast.error('Error al guardar contexto')
    } finally {
      setSavingCtx(false)
    }
  }

  const handleSaveMeta = async () => {
    if (!metaForm.access_token.trim()) return toast.error('El Access Token es obligatorio')
    setSavingMeta(true)
    try {
      await saveMetaConfig(metaForm)
      toast.success('Credenciales Meta guardadas')
      check()
    } catch {
      toast.error('Error al guardar credenciales')
    } finally {
      setSavingMeta(false)
    }
  }

  const check = async () => {
    setChecking(true)
    const [k, w, g, m, c, mt] = await Promise.allSettled([
      getKommoStatus(), getWhatsappStatus(), getGoogleStatus(), getMLStatus(), getClaudeStatus(), getMetaStatus()
    ])
    setStatuses({
      kommo:  k.status === 'fulfilled' ? k.value : { connected: false },
      wa:     w.status === 'fulfilled' ? w.value : { connected: false },
      google: g.status === 'fulfilled' ? g.value : { connected: false },
      ml:     m.status === 'fulfilled' ? m.value : { connected: false },
      claude: c.status === 'fulfilled' ? c.value : { connected: false },
      meta:   mt.status === 'fulfilled' ? { connected: mt.value.configured } : { connected: false },
    })
    setChecking(false)
  }

  useEffect(() => {
    check()
    getBusinessContext().then(r => setBizContext(r.context)).catch(() => {})
  }, [])

  const connected = Object.values(statuses).filter(s => s?.connected).length
  const total = services.length

  return (
    <div className="page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="text-sm text-slate-400 mt-0.5">{connected} de {total} servicios activos</p>
        </div>
        <button onClick={check} disabled={checking} className="btn-secondary self-start">
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          Verificar
        </button>
      </div>

      {/* Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">Estado del sistema</span>
          <span className="text-xs font-bold text-brand-accent">{connected}/{services.length} activos</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-brand-accent to-brand-mid transition-all duration-500"
            style={{ width: `${(connected / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Services */}
      <div className="card overflow-hidden divide-y divide-slate-50">
        {services.map(svc => {
          const status = statuses[svc.key]
          const ok = status?.connected ?? null
          const Icon = svc.icon
          return (
            <div key={svc.key} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${svc.gradient} flex items-center justify-center shrink-0`}>
                <Icon size={17} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">{svc.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{svc.desc}</p>
              </div>
              <div className="shrink-0">
                {ok === null
                  ? <span className="flex items-center gap-1.5 text-xs text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-200 animate-pulse" />Verificando</span>
                  : ok
                  ? <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><CheckCircle size={14} />Conectado</span>
                  : <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500"><XCircle size={14} />Sin conexión</span>
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* Meta credentials form */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shrink-0">
            <Key size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Credenciales Meta (Instagram + Facebook)</p>
            <p className="text-xs text-slate-400 mt-0.5">Guardá los tokens para habilitar la publicación directa desde el panel</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Access Token</label>
            <input
              className="input font-mono text-xs"
              placeholder="EAAxxxxxx..."
              value={metaForm.access_token}
              onChange={e => setMetaForm(f => ({ ...f, access_token: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Page ID (Facebook)</label>
            <input
              className="input font-mono text-xs"
              placeholder="123456789"
              value={metaForm.page_id}
              onChange={e => setMetaForm(f => ({ ...f, page_id: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">IG Account ID</label>
            <input
              className="input font-mono text-xs"
              placeholder="17841400000000000"
              value={metaForm.ig_account_id}
              onChange={e => setMetaForm(f => ({ ...f, ig_account_id: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Ad Account ID <span className="font-normal text-slate-400">(para anuncios pagados)</span></label>
            <input
              className="input font-mono text-xs"
              placeholder="Ej: 1234567890 (sin act_)"
              value={metaForm.ad_account_id}
              onChange={e => setMetaForm(f => ({ ...f, ad_account_id: e.target.value }))}
            />
          </div>
        </div>
        <button onClick={handleSaveMeta} disabled={savingMeta} className="btn-primary self-start">
          <Save size={13} />
          {savingMeta ? 'Guardando...' : 'Guardar credenciales'}
        </button>
      </div>

      {/* Business context for AI */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shrink-0">
            <FileText size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Contexto de la empresa (para la IA)</p>
            <p className="text-xs text-slate-400 mt-0.5">Describí tu empresa, productos y diferenciales — la IA usará esto para generar los posts</p>
          </div>
        </div>
        <textarea
          className="input min-h-[160px] resize-y text-sm leading-relaxed"
          placeholder={`Ejemplo:
Somos Indumentaria Segura SRL, fabricamos ropa de trabajo en Argentina desde 2008.
Nuestros productos: pantalones cargo, buzos, camperas, mamelucos, ambos médicos.
Vendemos a empresas, industrias y comercios. Talles S al 3XL, fabricación propia.
Contacto: WhatsApp +54 11 2301-1926 y Mercado Libre.`}
          value={bizContext}
          onChange={e => setBizContext(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Cuanto más detalle des, mejor serán los posts generados</p>
          <button onClick={handleSaveContext} disabled={savingCtx} className="btn-primary self-start">
            <Save size={13} />
            {savingCtx ? 'Guardando...' : 'Guardar contexto'}
          </button>
        </div>
      </div>

      {/* Help */}
      <div className="card border-blue-100 bg-blue-50/60 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Zap size={16} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-800 mb-1">¿Cómo configurar las credenciales?</p>
            <p className="text-xs text-blue-600 leading-relaxed">
              Las credenciales Meta se pueden guardar desde este panel. Para otros servicios, editá el archivo{' '}
              <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">.env</code> en el servidor y reiniciá con{' '}
              <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">docker compose restart</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
