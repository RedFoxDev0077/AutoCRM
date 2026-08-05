import { useState } from 'react'
import { Linkedin, Sparkles, Copy, Check, RefreshCw, Plus, Trash2, ExternalLink, Users, UserCog } from 'lucide-react'
import api from '../api/client'

interface ProfileResult { titular: string; resumen: string; experiencia: string; keywords: string }

interface Contact {
  id: string
  name: string
  company: string
  role: string
  linkedinUrl: string
  status: 'pendiente' | 'enviado' | 'respondio' | 'no_respondio'
  notes: string
  addedAt: string
}

const STATUS_COLORS: Record<string, string> = {
  pendiente:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  enviado:      'bg-blue-50 text-blue-700 border-blue-200',
  respondio:    'bg-green-50 text-green-700 border-green-200',
  no_respondio: 'bg-slate-50 text-slate-500 border-slate-200',
}

const STATUS_LABELS: Record<string, string> = {
  pendiente:    'Pendiente',
  enviado:      'Enviado',
  respondio:    'Respondió',
  no_respondio: 'Sin respuesta',
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0077b5] font-medium transition-all">
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function ProfileTab() {
  const [headline,   setHeadline]   = useState('')
  const [summary,    setSummary]    = useState('')
  const [experience, setExperience] = useState('')
  const [industry,   setIndustry]   = useState('')
  const [target,     setTarget]     = useState('')
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<ProfileResult | null>(null)
  const [error,      setError]      = useState('')

  const generate = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.post('/linkedin/profile', { headline, summary, experience, industry, target })
      setResult(res.data)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Error') }
    finally { setLoading(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
        <p className="text-xs text-slate-500">Pegá tu perfil actual y la IA lo reescribe de forma profesional. Podés dejarlo en blanco si todavía no tenés perfil.</p>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titular actual</label>
          <input value={headline} onChange={e => setHeadline(e.target.value)}
            placeholder="Ej: Dueño en Indumentaria Segura"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077b5]" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Resumen / Acerca de</label>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
            placeholder="Pegá tu resumen actual o dejalo en blanco"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0077b5] placeholder-slate-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descripción de experiencia actual</label>
          <textarea value={experience} onChange={e => setExperience(e.target.value)} rows={3}
            placeholder="Descripción del cargo en Indumentaria Segura (si tenés)"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0077b5] placeholder-slate-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Industria <span className="font-normal text-slate-400">(opcional)</span></label>
            <input value={industry} onChange={e => setIndustry(e.target.value)}
              placeholder="Ej: textil, indumentaria"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077b5]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Público objetivo <span className="font-normal text-slate-400">(opcional)</span></label>
            <input value={target} onChange={e => setTarget(e.target.value)}
              placeholder="Ej: empresas industriales"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077b5]" />
          </div>
        </div>
        <button onClick={generate} disabled={loading}
          className="w-full py-3 rounded-xl bg-[#0077b5] hover:bg-[#006097] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all">
          {loading ? <><RefreshCw size={15} className="animate-spin" /> Optimizando...</> : <><UserCog size={15} /> Optimizar perfil con IA</>}
        </button>
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      </div>

      <div className="space-y-3">
        {!result && !loading && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 flex flex-col items-center justify-center text-center min-h-[300px]">
            <UserCog size={28} className="text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">Tu perfil optimizado aparecerá aquí</p>
          </div>
        )}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 flex flex-col items-center justify-center min-h-[300px]">
            <RefreshCw size={22} className="animate-spin text-[#0077b5] mb-3" />
            <p className="text-sm text-slate-500">Optimizando perfil...</p>
          </div>
        )}
        {result && !loading && (
          <>
            {(['titular', 'resumen', 'experiencia', 'keywords'] as const).map(key => (
              result[key] ? (
                <div key={key} className="bg-white rounded-2xl border border-[#0077b5]/20 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{key}</span>
                    <ProfileCopyBtn text={result[key]} />
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{result[key]}</p>
                </div>
              ) : null
            ))}
            <button onClick={generate}
              className="w-full text-xs text-slate-400 hover:text-[#0077b5] flex items-center justify-center gap-1.5 py-2 transition-colors">
              <RefreshCw size={11} /> Regenerar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ProfileCopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 transition-all">
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function loadContacts(): Contact[] {
  try { return JSON.parse(localStorage.getItem('linkedin_contacts') || '[]') }
  catch { return [] }
}

export default function LinkedIn() {
  const [tab, setTab] = useState<'mensaje' | 'perfil' | 'contactos'>('mensaje')

  // Message generator
  const [prospectName, setProspectName] = useState('')
  const [company,      setCompany]      = useState('')
  const [role,         setRole]         = useState('')
  const [goal,         setGoal]         = useState('')
  const [context,      setContext]      = useState('')
  const [loading,      setLoading]      = useState(false)
  const [message,      setMessage]      = useState('')
  const [error,        setError]        = useState('')

  // Contacts tracker
  const [contacts,     setContacts]     = useState<Contact[]>(loadContacts)
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [newC, setNewC] = useState({ name: '', company: '', role: '', linkedinUrl: '', notes: '' })

  const saveContacts = (list: Contact[]) => {
    setContacts(list)
    localStorage.setItem('linkedin_contacts', JSON.stringify(list))
  }

  const addContact = () => {
    if (!newC.name.trim()) return
    const c: Contact = {
      id: Date.now().toString(), ...newC,
      status: 'pendiente',
      addedAt: new Date().toLocaleDateString('es-AR'),
    }
    saveContacts([c, ...contacts])
    setNewC({ name: '', company: '', role: '', linkedinUrl: '', notes: '' })
    setShowAddForm(false)
  }

  const generate = async () => {
    if (!prospectName.trim()) return
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await api.post('/linkedin/message', {
        prospect_name: prospectName, company, role, goal, context,
      })
      setMessage(res.data.message)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error generando mensaje')
    } finally { setLoading(false) }
  }

  const selectAll = (e: React.FocusEvent<HTMLTextAreaElement>) => e.target.select()

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-[#0077b5] flex items-center justify-center">
          <Linkedin size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">LinkedIn Outreach IA</h1>
          <p className="text-sm text-slate-500">Mensajes personalizados y seguimiento de prospectos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {[
          { key: 'mensaje',   label: 'Generar mensaje' },
          { key: 'perfil',    label: 'Optimizar perfil' },
          { key: 'contactos', label: `Contactos (${contacts.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── Mensaje Tab ── */}
      {tab === 'mensaje' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre del prospecto *</label>
              <input value={prospectName} onChange={e => setProspectName(e.target.value)}
                placeholder="Ej: Juan Rodríguez"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077b5]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Empresa</label>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Ej: Acero SA"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077b5]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cargo</label>
                <input value={role} onChange={e => setRole(e.target.value)} placeholder="Ej: Jefe de compras"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077b5]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Objetivo del mensaje</label>
              <input value={goal} onChange={e => setGoal(e.target.value)}
                placeholder="Ej: presentar nuestra línea de uniformes industriales"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077b5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Contexto <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <textarea value={context} onChange={e => setContext(e.target.value)} rows={2}
                placeholder="Ej: industria metalúrgica, 200 empleados, están en expansión..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0077b5] placeholder-slate-400" />
            </div>
            <button onClick={generate} disabled={loading || !prospectName.trim()}
              className="w-full py-3 rounded-xl bg-[#0077b5] hover:bg-[#006097] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all">
              {loading
                ? <><RefreshCw size={15} className="animate-spin" /> Generando...</>
                : <><Sparkles size={15} /> Generar mensaje</>}
            </button>
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          </div>

          <div>
            {!message && !loading && (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 flex flex-col items-center justify-center text-center min-h-[200px]">
                <Linkedin size={28} className="text-slate-200 mb-3" />
                <p className="text-sm text-slate-400">El mensaje generado aparecerá aquí</p>
              </div>
            )}
            {loading && (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 flex flex-col items-center justify-center min-h-[200px]">
                <RefreshCw size={22} className="animate-spin text-[#0077b5] mb-3" />
                <p className="text-sm text-slate-500">Personalizando mensaje...</p>
              </div>
            )}
            {message && !loading && (
              <div className="bg-white rounded-2xl border border-[#0077b5]/30 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mensaje generado</span>
                  <CopyBtn text={message} />
                </div>
                <textarea readOnly value={message} onFocus={selectAll} rows={8}
                  className="w-full text-sm text-slate-700 leading-relaxed resize-none bg-transparent focus:outline-none cursor-text" />
                <button onClick={generate}
                  className="mt-2 text-xs text-slate-400 hover:text-[#0077b5] flex items-center gap-1.5 transition-colors">
                  <RefreshCw size={11} /> Regenerar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Perfil Tab ── */}
      {tab === 'perfil' && <ProfileTab />}

      {/* ── Contactos Tab ── */}
      {tab === 'contactos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{contacts.length} contactos registrados</p>
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0077b5] text-white text-sm font-semibold hover:bg-[#006097] transition-all">
              <Plus size={15} /> Agregar contacto
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-700">Nuevo contacto LinkedIn</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'name',        label: 'Nombre *',    ph: 'Nombre completo' },
                  { key: 'company',     label: 'Empresa',     ph: 'Empresa' },
                  { key: 'role',        label: 'Cargo',       ph: 'Cargo' },
                  { key: 'linkedinUrl', label: 'URL perfil',  ph: 'linkedin.com/in/...' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">{f.label}</label>
                    <input value={(newC as any)[f.key]} placeholder={f.ph}
                      onChange={e => setNewC({...newC, [f.key]: e.target.value})}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077b5]" />
                  </div>
                ))}
              </div>
              <input value={newC.notes} placeholder="Notas (opcional)"
                onChange={e => setNewC({...newC, notes: e.target.value})}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0077b5]" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">Cancelar</button>
                <button onClick={addContact} disabled={!newC.name.trim()}
                  className="px-4 py-2 rounded-xl bg-[#0077b5] text-white text-sm font-semibold hover:bg-[#006097] disabled:opacity-50">Guardar</button>
              </div>
            </div>
          )}

          {contacts.length === 0 && !showAddForm && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
              <Users size={28} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No hay contactos agregados todavía</p>
              <p className="text-xs text-slate-400 mt-1">Agregá prospectos de LinkedIn para hacer seguimiento</p>
            </div>
          )}

          {contacts.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Linkedin size={16} className="text-[#0077b5]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <span className="font-semibold text-sm text-slate-800">{c.name}</span>
                    {c.company && <span className="text-sm text-slate-500 ml-1">· {c.company}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.linkedinUrl && (
                      <a href={c.linkedinUrl.startsWith('http') ? c.linkedinUrl : `https://${c.linkedinUrl}`}
                        target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#0077b5]">
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <button onClick={() => saveContacts(contacts.filter(x => x.id !== c.id))}
                      className="text-slate-300 hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                </div>
                {c.role  && <p className="text-xs text-slate-500 mb-1">{c.role}</p>}
                {c.notes && <p className="text-xs text-slate-400 mb-2 italic">{c.notes}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={c.status}
                    onChange={e => saveContacts(contacts.map(x => x.id === c.id ? {...x, status: e.target.value as Contact['status']} : x))}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none ${STATUS_COLORS[c.status]}`}>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <span className="text-xs text-slate-400">{c.addedAt}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
